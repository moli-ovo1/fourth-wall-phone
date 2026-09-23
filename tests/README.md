# Identity isolation regression checks

Run Web tests from the repository root:

```sh
node --experimental-vm-modules --test tests/identity-isolation.mjs
```

The suite loads production modules with in-memory storage and simulated MCP/model responses. It covers account failure without fallback, explicit binding approval, context changes, external-result provenance, unsupported-tools classification, snapshot mismatch, replay rejection and valid community replay. It does not call live services.

Android checks use production `CompanionContracts.java` and `McpProfileStore.java`, with test-only Context/preferences/vault doubles. Compile those two production files together with the Java sources under `tests/android-identity`, using a real `org.json` JVM jar on the classpath, then run `IdentityTest`. Keep these test doubles out of the APK. Thirteen assertions cover account separation, credential replacement, contract/snapshot/author validation and provenance.

Full Android compilation must separately use Android SDK 35 and the app's AndroidX dependencies. JVM checks do not validate Keystore encryption, device networking, WorkManager behavior or APK installation.

Manual acceptance still required: Character A and Persona B remain distinct through native tools and observation fallback; dedicated-account failure never uses the shared account; account switching during a call rejects its result; valid community posts/replies retain their Character author; Story-Aligned behavior remains unchanged. Use a matching contract-v2 Companion build, reapprove legacy dedicated bindings, save MCP profiles and sync new Wake snapshots before testing Android replay. Do not automatically import contract-v1 pending results or rewrite existing history.
