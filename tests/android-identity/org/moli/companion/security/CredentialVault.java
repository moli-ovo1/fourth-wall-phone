package org.moli.companion.security;
import android.content.Context;
import java.util.*;
/** Test double: no real credentials, Keystore, or encryption. */
public class CredentialVault {
  private final Map<String,String> values=new HashMap<>();
  public CredentialVault(Context c){}
  public void put(String key,String value){values.put(key,value);}
  public String get(String key){return values.getOrDefault(key,"");}
}
