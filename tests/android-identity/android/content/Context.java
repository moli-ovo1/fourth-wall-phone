package android.content;
import java.util.*;
/** Test-only preferences; does not exercise Android storage or encryption. */
public class Context {
  public static final int MODE_PRIVATE=0;
  private final Map<String,SharedPreferences> stores=new HashMap<>();
  public SharedPreferences getSharedPreferences(String name,int mode){return stores.computeIfAbsent(name,k->new SharedPreferences());}
}
