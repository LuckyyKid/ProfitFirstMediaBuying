
CREATE OR REPLACE FUNCTION public.vault_store_secret(_name text, _value text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE sid uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  sid := vault.create_secret(_value, _name);
  RETURN sid;
END $$;

CREATE OR REPLACE FUNCTION public.vault_update_secret(_id uuid, _value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  PERFORM vault.update_secret(_id, _value);
END $$;

CREATE OR REPLACE FUNCTION public.vault_read_secret(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT decrypted_secret INTO v FROM vault.decrypted_secrets WHERE id = _id;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.vault_delete_secret(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM vault.secrets WHERE id = _id;
END $$;

REVOKE ALL ON FUNCTION public.vault_store_secret(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vault_update_secret(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vault_read_secret(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vault_delete_secret(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.vault_store_secret(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_update_secret(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_read_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_delete_secret(uuid) TO service_role;
