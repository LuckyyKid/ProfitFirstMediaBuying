#!/usr/bin/env python3
"""Batch statistical layer for GOS Data Analyst.

This script is intentionally outside the React runtime. It reads normalized JSON,
uses Python analytics libraries for statistical work, and writes an auditable JSON
artifact that can be stored in model_runs.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import scipy
from scipy import stats


ENGINE_VERSION = "data_analyst_statistical_upgrade_v1"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def number(value: Any, default: float | None = None) -> float | None:
    if value is None or value == "":
        return default
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    return n if math.isfinite(n) else default


def round_or_none(value: Any, digits: int = 4) -> float | None:
    n = number(value)
    return round(n, digits) if n is not None else None


def clean_json(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): clean_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean_json(v) for v in value]
    if isinstance(value, tuple):
        return [clean_json(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        n = float(value)
        return n if math.isfinite(n) else None
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if pd.isna(value):
        return None
    return value


def month_index(value: Any) -> int | None:
    try:
        return pd.Period(str(value), freq="M").ordinal
    except Exception:
        return None


def load_input(path: str | None) -> dict[str, Any]:
    if not path:
        return build_synthetic_input()
    with Path(path).open("r", encoding="utf-8") as fh:
        return json.load(fh)


def prepare_transactions(rows: list[dict[str, Any]]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows).copy()
    for col in ["customer_id", "transaction_date"]:
        if col not in df.columns:
            df[col] = None

    df["customer_id"] = df["customer_id"].astype(str).str.strip()
    df["transaction_date"] = pd.to_datetime(df["transaction_date"], errors="coerce", utc=True).dt.tz_convert(None)
    df = df[df["customer_id"].ne("") & df["transaction_date"].notna()].copy()
    if df.empty:
        return df

    df["transaction_month"] = df["transaction_date"].dt.to_period("M").astype(str)
    acquisition = df.groupby("customer_id", as_index=False)["transaction_date"].min()
    acquisition = acquisition.rename(columns={"transaction_date": "acquisition_date"})
    df = df.merge(acquisition, on="customer_id", how="left")
    df["acquisition_month"] = df["acquisition_date"].dt.to_period("M").astype(str)
    df["transaction_month_index"] = df["transaction_month"].map(month_index)
    df["acquisition_month_index"] = df["acquisition_month"].map(month_index)
    df["age_index"] = (df["transaction_month_index"] - df["acquisition_month_index"]).clip(lower=0).astype(int)
    return df


def retention_curve(transactions: pd.DataFrame) -> dict[str, Any]:
    if transactions.empty:
        return {
            "method": "monthly_acquisition_cohort_log_survival",
            "status": "insufficient_data",
            "cohorts": 0,
            "age_periods": 0,
            "observed_survival_by_age": [],
            "fitted_curve": [],
            "half_life_months": None,
            "r_squared": None,
            "backtest_mape_pct": None,
            "diagnostics": ["No valid transactions with customer_id and transaction_date."],
        }

    cohort_size = (
        transactions.groupby("acquisition_month")["customer_id"]
        .nunique()
        .rename("cohort_size")
        .reset_index()
    )
    active = (
        transactions.groupby(["acquisition_month", "age_index"])["customer_id"]
        .nunique()
        .rename("active_customers")
        .reset_index()
        .merge(cohort_size, on="acquisition_month", how="left")
    )
    active["survival_rate"] = active["active_customers"] / active["cohort_size"].replace(0, np.nan)
    observed = (
        active.groupby("age_index")
        .agg(
            survival_rate=("survival_rate", "mean"),
            cohort_count=("acquisition_month", "nunique"),
            active_customers=("active_customers", "sum"),
        )
        .reset_index()
        .sort_values("age_index")
    )

    diagnostics: list[str] = []
    if cohort_size.shape[0] < 3:
        diagnostics.append("At least 3 acquisition cohorts are recommended for stable retention fitting.")
    if observed.shape[0] < 3:
        diagnostics.append("At least 3 age periods are recommended for curve fitting.")

    fit = observed[(observed["age_index"] > 0) & (observed["survival_rate"] > 0)].copy()
    if fit.shape[0] < 3:
        return {
            "method": "monthly_acquisition_cohort_log_survival",
            "status": "insufficient_data",
            "cohorts": int(cohort_size.shape[0]),
            "age_periods": int(observed.shape[0]),
            "observed_survival_by_age": [
                {
                    "age_index": int(row.age_index),
                    "survival_pct": round(float(row.survival_rate) * 100, 2),
                    "cohort_count": int(row.cohort_count),
                }
                for row in observed.itertuples()
            ],
            "fitted_curve": [],
            "half_life_months": None,
            "r_squared": None,
            "backtest_mape_pct": None,
            "diagnostics": diagnostics or ["Not enough post-acquisition survival observations."],
        }

    x = fit["age_index"].astype(float).to_numpy()
    y = np.log(fit["survival_rate"].clip(lower=0.0001).to_numpy())
    regression = stats.linregress(x, y)
    predictions = regression.intercept + regression.slope * x
    residuals = y - predictions
    residual_std = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else 0.0

    max_age = int(max(12, observed["age_index"].max()))
    curve = []
    for age in range(max_age + 1):
        log_pred = regression.intercept + regression.slope * age
        pred = float(np.exp(log_pred))
        low = float(np.exp(log_pred - 1.96 * residual_std))
        high = float(np.exp(log_pred + 1.96 * residual_std))
        curve.append({
            "age_index": age,
            "survival_pct": round(max(0.0, min(1.0, pred)) * 100, 2),
            "ci_low_pct": round(max(0.0, min(1.0, low)) * 100, 2),
            "ci_high_pct": round(max(0.0, min(1.0, high)) * 100, 2),
        })

    heldout_mape = None
    if fit.shape[0] >= 4:
        train = fit.iloc[:-1]
        test = fit.iloc[-1]
        bt = stats.linregress(
            train["age_index"].astype(float).to_numpy(),
            np.log(train["survival_rate"].clip(lower=0.0001).to_numpy()),
        )
        pred = float(np.exp(bt.intercept + bt.slope * float(test["age_index"])))
        actual = float(test["survival_rate"])
        if actual > 0:
            heldout_mape = abs((pred - actual) / actual) * 100

    half_life = None
    if regression.slope < 0:
        half_life = math.log(0.5) / regression.slope

    if regression.rvalue ** 2 < 0.5:
        diagnostics.append("Low retention curve fit quality; inspect cohort mix and seasonality.")
    if heldout_mape is not None and heldout_mape > 30:
        diagnostics.append("Backtest error above 30%; forecast should stay directional.")

    return {
        "method": "monthly_acquisition_cohort_log_survival",
        "status": "fit" if regression.slope < 0 else "directional",
        "cohorts": int(cohort_size.shape[0]),
        "age_periods": int(observed.shape[0]),
        "observed_survival_by_age": [
            {
                "age_index": int(row.age_index),
                "survival_pct": round(float(row.survival_rate) * 100, 2),
                "cohort_count": int(row.cohort_count),
            }
            for row in observed.itertuples()
        ],
        "fitted_curve": curve,
        "half_life_months": round_or_none(half_life, 2),
        "r_squared": round_or_none(regression.rvalue ** 2, 4),
        "backtest_mape_pct": round_or_none(heldout_mape, 2),
        "diagnostics": diagnostics,
    }


def projection_value(row: pd.Series, projection_col: str, target_col: str) -> float | None:
    projected = number(row.get(projection_col))
    if projected is not None:
        return projected
    return number(row.get(target_col))


def pnl_anomalies(rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        return {
            "method": "robust_mad_projection_residuals",
            "rows_analyzed": 0,
            "anomalies": [],
            "diagnostics": ["No daily P&L rows provided."],
        }

    df = pd.DataFrame(rows).copy()
    if "target_date" not in df.columns:
        df["target_date"] = None

    anomalies: list[dict[str, Any]] = []
    diagnostics: list[str] = []
    analyzed = 0

    metric_defs = [
        ("revenue", "actual_revenue", "projection_revenue", "target_revenue"),
        ("ad_spend", "actual_ad_spend", "projection_ad_spend", "target_ad_spend"),
    ]

    for metric, actual_col, projection_col, target_col in metric_defs:
        residual_rows: list[dict[str, Any]] = []
        for _, row in df.iterrows():
            actual = number(row.get(actual_col))
            expected = projection_value(row, projection_col, target_col)
            if actual is None or expected is None or expected == 0:
                continue
            delta_pct = ((actual - expected) / expected) * 100
            residual_rows.append({
                "date": str(row.get("target_date") or ""),
                "metric": metric,
                "actual": actual,
                "expected": expected,
                "delta_pct": delta_pct,
            })

        if not residual_rows:
            diagnostics.append(f"No analyzable {metric} actual/projection rows.")
            continue

        analyzed += len(residual_rows)
        residuals = np.array([row["delta_pct"] for row in residual_rows], dtype=float)
        median = float(np.median(residuals))
        mad = float(np.median(np.abs(residuals - median)))
        scale = mad if mad > 0 else float(np.std(residuals, ddof=1)) if len(residuals) > 1 else 0.0

        for row in residual_rows:
            robust_z = 0.0 if scale == 0 else 0.6745 * (row["delta_pct"] - median) / scale
            if abs(robust_z) >= 2.5 or abs(row["delta_pct"]) >= 25:
                severity = "critical" if abs(robust_z) >= 3.5 or abs(row["delta_pct"]) >= 35 else "warning"
                anomalies.append({
                    "date": row["date"],
                    "metric": row["metric"],
                    "actual": round(row["actual"], 2),
                    "expected": round(row["expected"], 2),
                    "delta_pct": round(row["delta_pct"], 2),
                    "robust_z": round(robust_z, 3),
                    "severity": severity,
                })

    return {
        "method": "robust_mad_projection_residuals",
        "rows_analyzed": analyzed,
        "anomalies": sorted(anomalies, key=lambda row: (row["severity"] != "critical", row["date"])),
        "diagnostics": diagnostics,
    }


def spend_efficiency_regression(input_data: dict[str, Any], daily_rows: list[dict[str, Any]]) -> dict[str, Any]:
    history = input_data.get("spend_history") or []
    rows: list[dict[str, Any]] = []

    if history:
        for row in history:
            spend = number(row.get("spend"))
            revenue = number(row.get("new_customer_revenue") or row.get("revenue"))
            if spend and spend > 0 and revenue and revenue > 0:
                rows.append({
                    "period": str(row.get("period") or ""),
                    "spend": spend,
                    "revenue": revenue,
                })
    else:
        for row in daily_rows:
            spend = number(row.get("actual_ad_spend"))
            revenue = number(row.get("actual_revenue"))
            if spend and spend > 0 and revenue and revenue > 0:
                rows.append({
                    "period": str(row.get("target_date") or ""),
                    "spend": spend,
                    "revenue": revenue,
                })

    if len(rows) < 4:
        return {
            "method": "log_log_spend_to_revenue_regression",
            "status": "insufficient_data",
            "observations": len(rows),
            "elasticity": None,
            "intercept": None,
            "r_squared": None,
            "p_value": None,
            "standard_error": None,
            "diagnostics": ["At least 4 positive spend/revenue periods are required."],
            "points": rows,
        }

    df = pd.DataFrame(rows)
    x = np.log(df["spend"].astype(float).to_numpy())
    y = np.log(df["revenue"].astype(float).to_numpy())
    regression = stats.linregress(x, y)

    diagnostics = []
    if regression.slope <= 0:
        diagnostics.append("Spend elasticity is not positive; inspect tracking or channel mix.")
    if regression.rvalue ** 2 < 0.5:
        diagnostics.append("Weak fit; use as directional only and prefer more historical periods.")
    if regression.pvalue >= 0.1:
        diagnostics.append("Regression p-value is weak; do not use this alone for spend decisions.")

    return {
        "method": "log_log_spend_to_revenue_regression",
        "status": "fit",
        "observations": len(rows),
        "elasticity": round_or_none(regression.slope, 4),
        "intercept": round_or_none(regression.intercept, 4),
        "r_squared": round_or_none(regression.rvalue ** 2, 4),
        "p_value": round_or_none(regression.pvalue, 6),
        "standard_error": round_or_none(regression.stderr, 6),
        "diagnostics": diagnostics,
        "points": [
            {"period": row["period"], "spend": round(row["spend"], 2), "revenue": round(row["revenue"], 2)}
            for row in rows
        ],
    }


def first_number(row: dict[str, Any], keys: list[str]) -> float | None:
    for key in keys:
        value = number(row.get(key))
        if value is not None:
            return value
    return None


def first_text(row: dict[str, Any], keys: list[str], default: str) -> str:
    for key in keys:
        value = str(row.get(key) or "").strip()
        if value:
            return value
    return default


def prepare_channel_daily(
    input_data: dict[str, Any],
    daily_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], str]:
    raw_rows = input_data.get("channel_daily") or []
    rows: list[dict[str, Any]] = []

    for raw in raw_rows:
        if not isinstance(raw, dict):
            continue
        date = first_text(raw, ["date", "perf_date", "target_date"], "")[:10]
        channel = first_text(raw, ["channel", "platform", "channel_name"], "unknown")
        spend = first_number(raw, ["spend", "actual_ad_spend"])
        if not date or spend is None or spend < 0:
            continue
        rows.append({
            "date": date,
            "channel": channel,
            "spend": spend,
            "revenue": first_number(raw, ["revenue", "actual_revenue", "new_customer_revenue"]),
            "orders": first_number(raw, ["orders", "actual_orders"]),
            "leads": first_number(raw, ["leads", "actual_leads"]),
        })

    if rows:
        return sorted(rows, key=lambda row: (row["date"], row["channel"])), "channel_daily"

    for raw in daily_rows:
        if not isinstance(raw, dict):
            continue
        date = first_text(raw, ["target_date", "date"], "")[:10]
        spend = first_number(raw, ["actual_ad_spend"])
        revenue = first_number(raw, ["actual_revenue"])
        if not date or spend is None or spend <= 0 or revenue is None or revenue <= 0:
            continue
        rows.append({
            "date": date,
            "channel": "blended_paid_media",
            "spend": spend,
            "revenue": revenue,
            "orders": first_number(raw, ["actual_orders"]),
            "leads": first_number(raw, ["actual_leads"]),
        })

    return sorted(rows, key=lambda row: (row["date"], row["channel"])), "daily_pnl_blended_fallback"


def adstock_series(values: np.ndarray, decay: float = 0.35) -> np.ndarray:
    out = np.zeros_like(values, dtype=float)
    carry = 0.0
    for index, value in enumerate(values):
        carry = float(value) + carry * decay
        out[index] = carry
    return out


def lightweight_mmm_incrementality(input_data: dict[str, Any], daily_rows: list[dict[str, Any]]) -> dict[str, Any]:
    channel_rows, source = prepare_channel_daily(input_data, daily_rows)
    if len(channel_rows) < 7:
        return {
            "method": "lightweight_adstock_ridge_mmm",
            "status": "insufficient_data",
            "data_source": source,
            "observations": len(channel_rows),
            "channels": [],
            "portfolio": {
                "total_spend": 0,
                "observed_revenue": 0,
                "estimated_incremental_revenue": 0,
                "weighted_incrementality_factor": None,
                "weighted_incremental_roas": None,
                "r_squared": None,
            },
            "diagnostics": ["At least 7 dated channel spend rows are required."],
            "limitations": ["MMM output is unavailable until channel-level daily performance exists."],
        }

    df = pd.DataFrame(channel_rows).copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["spend"] = pd.to_numeric(df["spend"], errors="coerce").fillna(0.0)
    df["revenue"] = pd.to_numeric(df["revenue"], errors="coerce").fillna(0.0)
    df = df[df["date"].notna()].copy()
    if df.empty:
        return {
            "method": "lightweight_adstock_ridge_mmm",
            "status": "insufficient_data",
            "data_source": source,
            "observations": 0,
            "channels": [],
            "portfolio": {
                "total_spend": 0,
                "observed_revenue": 0,
                "estimated_incremental_revenue": 0,
                "weighted_incrementality_factor": None,
                "weighted_incremental_roas": None,
                "r_squared": None,
            },
            "diagnostics": ["No valid dated channel rows after parsing."],
            "limitations": ["MMM output is unavailable until channel-level daily performance exists."],
        }

    spend_pivot = df.pivot_table(index="date", columns="channel", values="spend", aggfunc="sum").fillna(0.0).sort_index()
    pnl_revenue_rows: list[dict[str, Any]] = []
    for raw in daily_rows:
        if not isinstance(raw, dict):
            continue
        date = first_text(raw, ["target_date", "date"], "")[:10]
        revenue = first_number(raw, ["actual_revenue"])
        if date and revenue is not None and revenue > 0:
            pnl_revenue_rows.append({"date": date, "revenue": revenue})

    if pnl_revenue_rows:
        revenue_frame = pd.DataFrame(pnl_revenue_rows)
        revenue_frame["date"] = pd.to_datetime(revenue_frame["date"], errors="coerce")
        y_series = revenue_frame.dropna(subset=["date"]).groupby("date")["revenue"].sum()
        revenue_source = "daily_pnl.actual_revenue"
    else:
        y_series = df.groupby("date")["revenue"].sum()
        revenue_source = "channel_daily.revenue"

    common_dates = spend_pivot.index.intersection(y_series.index)
    spend_pivot = spend_pivot.loc[common_dates]
    y = y_series.loc[common_dates].astype(float).to_numpy()
    channels = [str(channel) for channel in spend_pivot.columns if float(spend_pivot[channel].sum()) > 0]
    observations = int(len(common_dates))
    total_spend = float(spend_pivot[channels].sum().sum()) if channels else 0.0
    observed_revenue = float(np.sum(y)) if len(y) else 0.0

    diagnostics: list[str] = []
    if source == "daily_pnl_blended_fallback":
        diagnostics.append("Only blended daily P&L spend was available; channel attribution is directional.")
    if len(channels) < 2:
        diagnostics.append("Fewer than 2 paid channels are present; MMM cannot separate channel effects.")
    if observations < 14:
        diagnostics.append("Fewer than 14 observations; use output as directional context only.")

    if observations < 7 or not channels or total_spend <= 0 or observed_revenue <= 0:
        return {
            "method": "lightweight_adstock_ridge_mmm",
            "status": "insufficient_data",
            "data_source": source,
            "revenue_source": revenue_source,
            "observations": observations,
            "channels": [],
            "portfolio": {
                "total_spend": round(total_spend, 2),
                "observed_revenue": round(observed_revenue, 2),
                "estimated_incremental_revenue": 0,
                "weighted_incrementality_factor": None,
                "weighted_incremental_roas": None,
                "r_squared": None,
            },
            "diagnostics": diagnostics or ["Need positive spend and revenue by date."],
            "limitations": ["MMM output is unavailable until channel-level daily performance exists."],
        }

    raw_matrix = np.column_stack([
        adstock_series(spend_pivot[channel].astype(float).to_numpy())
        for channel in channels
    ])
    means = raw_matrix.mean(axis=0)
    stds = raw_matrix.std(axis=0)
    safe_stds = np.where(stds > 0, stds, 1.0)
    x = (raw_matrix - means) / safe_stds
    design = np.column_stack([np.ones(observations), x])
    penalty = np.eye(design.shape[1]) * 1.0
    penalty[0, 0] = 0.0
    beta = np.linalg.pinv(design.T @ design + penalty) @ design.T @ y
    fitted = design @ beta
    sst = float(np.sum((y - np.mean(y)) ** 2))
    sse = float(np.sum((y - fitted) ** 2))
    r_squared = None if sst <= 0 else max(0.0, min(1.0, 1 - sse / sst))
    if r_squared is None or r_squared < 0.3:
        diagnostics.append("Low MMM fit quality; prefer lift tests and deterministic guardrails.")

    original_coefficients = beta[1:] / safe_stds
    raw_contributions = np.maximum(0.0, original_coefficients * raw_matrix.sum(axis=0))
    raw_total = float(np.sum(raw_contributions))
    incremental_pool = min(raw_total, observed_revenue * 0.9) if raw_total > 0 else 0.0
    if raw_total <= 0:
        diagnostics.append("No positive channel coefficients; incremental contribution is capped at zero.")

    channel_outputs = []
    total_incremental = 0.0
    channel_revenue_total = 0.0
    for index, channel in enumerate(channels):
        channel_spend = float(spend_pivot[channel].sum())
        channel_observed_revenue = float(df[df["channel"] == channel]["revenue"].sum())
        estimated_incremental = (
            float(raw_contributions[index] / raw_total * incremental_pool)
            if raw_total > 0
            else 0.0
        )
        total_incremental += estimated_incremental
        channel_revenue_total += channel_observed_revenue
        channel_diagnostics: list[str] = []
        if original_coefficients[index] <= 0:
            channel_diagnostics.append("Coefficient is non-positive; estimated incremental revenue is zero.")

        channel_outputs.append({
            "channel": channel,
            "spend": round(channel_spend, 2),
            "observed_revenue": round(channel_observed_revenue, 2) if channel_observed_revenue > 0 else None,
            "estimated_incremental_revenue": round(estimated_incremental, 2),
            "incremental_roas": round_or_none(estimated_incremental / channel_spend if channel_spend > 0 else None, 4),
            "incrementality_factor": round_or_none(
                estimated_incremental / channel_observed_revenue
                if channel_observed_revenue > 0
                else None,
                4,
            ),
            "share_of_spend": round_or_none(channel_spend / total_spend if total_spend > 0 else None, 4),
            "share_of_incremental_revenue": round_or_none(
                estimated_incremental / total_incremental
                if total_incremental > 0
                else None,
                4,
            ),
            "coefficient": round_or_none(original_coefficients[index], 6),
            "diagnostics": channel_diagnostics,
        })

    total_incremental = float(sum(row["estimated_incremental_revenue"] for row in channel_outputs))
    for row in channel_outputs:
        row["share_of_incremental_revenue"] = round_or_none(
            float(row["estimated_incremental_revenue"]) / total_incremental
            if total_incremental > 0
            else None,
            4,
        )

    status = "fit" if len(channels) >= 2 and observations >= 14 and (r_squared or 0) >= 0.3 else "directional"
    return {
        "method": "lightweight_adstock_ridge_mmm",
        "status": status,
        "data_source": source,
        "revenue_source": revenue_source,
        "observations": observations,
        "adstock_decay": 0.35,
        "ridge_lambda": 1.0,
        "channels": channel_outputs,
        "portfolio": {
            "total_spend": round(total_spend, 2),
            "observed_revenue": round(observed_revenue, 2),
            "estimated_incremental_revenue": round(total_incremental, 2),
            "weighted_incrementality_factor": round_or_none(
                total_incremental / channel_revenue_total
                if channel_revenue_total > 0
                else None,
                4,
            ),
            "weighted_incremental_roas": round_or_none(
                total_incremental / total_spend
                if total_spend > 0
                else None,
                4,
            ),
            "r_squared": round_or_none(r_squared, 4),
        },
        "diagnostics": diagnostics,
        "limitations": [
            "This is a lightweight directional MMM, not production-grade Robyn.",
            "It is not causal proof and does not replace holdout or geo lift tests.",
            "Do not mutate budgets directly from this output; use it as reviewed channel-allocation context.",
        ],
    }


def readiness(retention: dict[str, Any], anomalies: dict[str, Any], regression: dict[str, Any], mmm: dict[str, Any]) -> str:
    retention_fit = retention.get("status") in {"fit", "directional"}
    anomaly_ready = anomalies.get("rows_analyzed", 0) >= 7
    regression_fit = regression.get("status") == "fit"
    mmm_ready = mmm.get("status") in {"fit", "directional"}

    if retention_fit and anomaly_ready and regression_fit and mmm_ready:
        return "READY_FOR_ADVANCED_ANALYSIS"
    if retention_fit or anomaly_ready or mmm_ready:
        return "READY_FOR_BASIC_ANALYSIS"
    return "BLOCKED"


def recommendations(
    retention: dict[str, Any],
    anomalies: dict[str, Any],
    regression: dict[str, Any],
    mmm: dict[str, Any],
) -> list[str]:
    out: list[str] = []
    if retention.get("status") == "insufficient_data":
        out.append("Add more customer transaction history before fitting retention curves.")
    elif retention.get("backtest_mape_pct") and retention["backtest_mape_pct"] > 30:
        out.append("Use retention forecast directionally until backtest error improves below 30%.")
    else:
        out.append("Use fitted retention curve to inform LTV guardrails, not as a standalone CAC approval.")

    critical_anomalies = [row for row in anomalies.get("anomalies", []) if row.get("severity") == "critical"]
    if critical_anomalies:
        out.append("Investigate critical P&L projection anomalies before updating media budgets.")
    elif anomalies.get("rows_analyzed", 0) >= 7:
        out.append("Projection residuals are analyzable; monitor new anomalies daily.")

    if regression.get("status") == "fit" and regression.get("r_squared", 0) >= 0.5:
        out.append("Use spend regression as a statistical companion to the deterministic spend frontier.")
    else:
        out.append("Keep spend decisions on deterministic frontier until regression has stronger fit.")

    if mmm.get("status") == "fit":
        out.append("Use MMM incrementality factors as reviewed channel-allocation context, not direct budget mutations.")
    elif mmm.get("status") == "directional":
        out.append("Treat MMM as directional until channel-level daily spend/revenue history is deeper.")
    else:
        out.append("Add channel-level daily campaign performance before using MMM incrementality context.")

    return out


def run_model(input_data: dict[str, Any]) -> dict[str, Any]:
    transactions = prepare_transactions(input_data.get("transactions") or [])
    daily_rows = input_data.get("daily_pnl") or input_data.get("dailyTargets") or []

    retention = retention_curve(transactions)
    anomalies = pnl_anomalies(daily_rows)
    regression = spend_efficiency_regression(input_data, daily_rows)
    mmm = lightweight_mmm_incrementality(input_data, daily_rows)
    model_readiness = readiness(retention, anomalies, regression, mmm)

    output = {
        "engine_version": ENGINE_VERSION,
        "generated_at": input_data.get("generated_at") or now_iso(),
        "client_id": input_data.get("client_id"),
        "readiness": model_readiness,
        "libraries": {
            "python": sys.version.split()[0],
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "statsmodels": "not_installed",
        },
        "model_card": {
            "purpose": "Batch statistical upgrade for retention, P&L anomalies, spend-efficiency diagnostics, and lightweight MMM incrementality context.",
            "inputs": ["transactions", "daily_pnl", "spend_history optional", "channel_daily optional"],
            "governance_checks": [
                "valid transaction customer_id and transaction_date",
                "minimum cohort and age-period thresholds",
                "actual versus projection residual checks",
                "regression fit, p-value, and R-squared diagnostics",
                "channel-level spend/revenue observations for MMM diagnostics",
                "MMM output is advisory and cannot mutate budgets directly",
            ],
            "assumptions": [
                "customer_id is stable across purchases",
                "transaction_date represents the purchase date",
                "projection fields are the latest AM forecast",
                "spend_history revenue is new-customer revenue when provided",
                "channel_daily rows are normalized by date and paid channel or platform",
            ],
            "limitations": [
                "retention curve uses log-linear survival and should be backtested before high-stakes use",
                "P&L anomaly detection is robust residual screening, not causal attribution",
                "spend regression does not replace incrementality testing or MMM",
                "lightweight MMM is directional and does not replace production-grade Robyn or lift testing",
            ],
        },
        "retention_curve": retention,
        "pnl_anomalies": anomalies,
        "spend_efficiency_regression": regression,
        "mmm_incrementality": mmm,
        "recommendations": recommendations(retention, anomalies, regression, mmm),
    }
    return clean_json(output)


def build_synthetic_input() -> dict[str, Any]:
    transactions: list[dict[str, Any]] = []
    acq_months = ["2026-01", "2026-02", "2026-03", "2026-04"]
    for i in range(120):
        acq = acq_months[(i // 30) % len(acq_months)]
        customer_id = f"customer-{i:03d}"
        transactions.append({
            "customer_id": customer_id,
            "transaction_date": f"{acq}-05",
            "order_id": f"order-{i:03d}-0",
            "revenue": 90 + (i % 7) * 5,
            "gross_profit": 45 + (i % 5) * 3,
        })
        if i % 2 == 0:
            month = pd.Period(acq, freq="M") + 1
            transactions.append({
                "customer_id": customer_id,
                "transaction_date": f"{month}-07",
                "order_id": f"order-{i:03d}-1",
                "revenue": 60 + (i % 5) * 4,
                "gross_profit": 30 + (i % 4) * 2,
            })
        if i % 5 == 0:
            month = pd.Period(acq, freq="M") + 2
            transactions.append({
                "customer_id": customer_id,
                "transaction_date": f"{month}-09",
                "order_id": f"order-{i:03d}-2",
                "revenue": 55 + (i % 3) * 4,
                "gross_profit": 25 + (i % 3) * 2,
            })
        if i % 11 == 0:
            month = pd.Period(acq, freq="M") + 3
            transactions.append({
                "customer_id": customer_id,
                "transaction_date": f"{month}-11",
                "order_id": f"order-{i:03d}-3",
                "revenue": 45 + (i % 3) * 3,
                "gross_profit": 20 + (i % 3) * 2,
            })

    daily_rows = []
    channel_daily = []
    for day in range(1, 22):
        meta_spend = 125 + (day % 5) * 14 + day * 2.5
        google_spend = 80 + ((day + 2) % 4) * 11 + day * 1.5
        projected_revenue = 480 + meta_spend * 2.45 + google_spend * 3.15 + (day % 6) * 18
        actual_revenue = projected_revenue * (1 + ((day % 4) - 1.5) / 100)
        projected_spend = meta_spend + google_spend
        actual_spend = projected_spend * (1 + ((day % 5) - 2) / 100)
        if day == 12:
            actual_revenue = projected_revenue * 0.58
        if day == 17:
            actual_spend = projected_spend * 1.42
        daily_rows.append({
            "target_date": f"2026-07-{day:02d}",
            "projection_revenue": projected_revenue,
            "actual_revenue": round(actual_revenue, 2),
            "projection_ad_spend": projected_spend,
            "actual_ad_spend": round(actual_spend, 2),
        })
        channel_daily.extend([
            {
                "date": f"2026-07-{day:02d}",
                "channel": "Meta",
                "spend": round(meta_spend * (1 + ((day % 3) - 1) / 100), 2),
                "revenue": round(meta_spend * 2.35 + (day % 4) * 7, 2),
                "orders": 2 + day % 3,
            },
            {
                "date": f"2026-07-{day:02d}",
                "channel": "Google",
                "spend": round(google_spend * (1 + ((day % 4) - 1.5) / 100), 2),
                "revenue": round(google_spend * 3.05 + (day % 5) * 9, 2),
                "orders": 1 + day % 4,
            },
        ])

    spend_history = [
        {"period": "2026-01", "spend": 6000, "new_customer_revenue": 23000},
        {"period": "2026-02", "spend": 7500, "new_customer_revenue": 27800},
        {"period": "2026-03", "spend": 9000, "new_customer_revenue": 31800},
        {"period": "2026-04", "spend": 11000, "new_customer_revenue": 37200},
        {"period": "2026-05", "spend": 13000, "new_customer_revenue": 41500},
        {"period": "2026-06", "spend": 16000, "new_customer_revenue": 47500},
    ]

    return {
        "client_id": "synthetic-client",
        "generated_at": "2026-07-15T00:00:00Z",
        "transactions": transactions,
        "daily_pnl": daily_rows,
        "spend_history": spend_history,
        "channel_daily": channel_daily,
    }


def self_test() -> None:
    output = run_model(build_synthetic_input())
    assert output["engine_version"] == ENGINE_VERSION
    assert output["readiness"] == "READY_FOR_ADVANCED_ANALYSIS"
    assert output["retention_curve"]["status"] in {"fit", "directional"}
    assert output["retention_curve"]["cohorts"] >= 3
    assert output["pnl_anomalies"]["rows_analyzed"] >= 20
    assert len(output["pnl_anomalies"]["anomalies"]) >= 1
    assert output["spend_efficiency_regression"]["status"] == "fit"
    assert output["spend_efficiency_regression"]["r_squared"] >= 0.5
    assert output["mmm_incrementality"]["status"] in {"fit", "directional"}
    assert output["mmm_incrementality"]["observations"] >= 14
    assert len(output["mmm_incrementality"]["channels"]) >= 2
    print(json.dumps({
        "ok": True,
        "engine_version": output["engine_version"],
        "readiness": output["readiness"],
        "anomalies": len(output["pnl_anomalies"]["anomalies"]),
        "retention_r_squared": output["retention_curve"]["r_squared"],
        "spend_r_squared": output["spend_efficiency_regression"]["r_squared"],
        "mmm_status": output["mmm_incrementality"]["status"],
        "mmm_r_squared": output["mmm_incrementality"]["portfolio"]["r_squared"],
    }, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run GOS Data Analyst statistical upgrade batch.")
    parser.add_argument("--input", help="Input JSON path. If omitted, a synthetic sample is used.")
    parser.add_argument("--output", help="Output JSON path. If omitted, JSON is printed to stdout.")
    parser.add_argument("--self-test", action="store_true", help="Run internal synthetic validation checks.")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return

    output = run_model(load_input(args.input))
    payload = json.dumps(output, indent=2)
    if args.output:
        Path(args.output).write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)


if __name__ == "__main__":
    main()
