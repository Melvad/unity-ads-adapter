# Melvad Ads for Unity

Binary Unity adapter for Melvad's Android and iOS advertising SDKs. Version 1.0.0
supports rewarded video through one C# API. Native SDKs 1.0.3 are included.

## Install

Download a package from [Releases](https://github.com/Melvad/unity-ads-adapter/releases):

- `.tgz`: Unity → Window → Package Manager → + → Install package from tarball.
- `.unitypackage`: Unity → Assets → Import Package → Custom Package.

Use one installation method per project. The UPM package is also available through
`https://github.com/Melvad/unity-ads-adapter.git?path=Packages/com.melvad.ads#v1.0.0`.

Tested profile: Unity **6000.6.9f1**, IL2CPP ARM64, Android API 29+ and iOS 16+.
Install the build support module for your target platform; iOS builds require macOS
and Xcode. The package configures native dependencies automatically. Internet access
is needed for the native Android SDK's public Maven dependencies.

## Rewarded video

Resolve consent with your CMP before initialization. Use the client, inventory and
placement IDs assigned to your application. Run these calls on the Unity main thread:

```csharp
using Melvad.Ads;
using UnityEngine;

MelvadAds.Initialize(
    new MelvadConfiguration(clientId, Application.identifier),
    new PrivacyContext(gdprApplies, consentString, personalizationAllowed));

RewardedAd ad = MelvadAds.CreateRewardedAd();
ad.Loaded += () => Debug.Log("Rewarded ad ready");
ad.RewardEarned += () => Debug.Log("Native reward condition met");
ad.ShowFailed += error => Debug.LogWarning(error.Code);
ad.Closed += () => ad.Dispose();
ad.Load(new AdPlacement(inventoryId, placementId));
// In response to the player's Show action:
if (ad.CanShow) ad.Show();
```

`RewardEarned` requires an impression and full rewarded playback. `VideoCompleted`
alone does not grant a reward. Typical order: `Loaded → Shown → Impression →
VideoCompleted → RewardEarned → Closed`. Callbacks arrive on the Unity main thread.
Dispose stops callbacks; ordinary ads are disposed when their owning scene unloads.
The game manages its own pause, sound and orientation.

Optional `ad.Load(placement, new RewardVerification(opaquePlayerReference))` selects
server reward verification when configured for your account. The local callback does
not confirm a server balance; obtain that confirmation from your backend. Use an
opaque game reference rather than an email or advertising identifier.

## Documentation and license

- [Integration guide](https://melvad.com/developers?lang=en#unity-sdk)
- [License](LICENSE): Melvad SDK License; integration and distribution within your application are permitted under its terms.
- Third-party terms are preserved in `Licenses/` and the native SDK resources.

This repository distributes compiled DLL, AAR and XCFramework components. Native
headers and Swift module interfaces are supplied where needed for compilation.
