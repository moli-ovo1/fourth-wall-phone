package android.content;
import java.util.*;
public class SharedPreferences {
  private final Map<String,String> values=new HashMap<>();
  public String getString(String key,String fallback){return values.getOrDefault(key,fallback);}
  public Editor edit(){return new Editor();}
  public class Editor {
    public Editor remove(String key){values.remove(key);return this;}
    public Editor putString(String key,String value){values.put(key,value);return this;}
    public boolean commit(){return true;}
  }
}
