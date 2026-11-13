# C# rewarded integration example

Add [RewardedController.cs](RewardedController.cs) to your game's scripts after
installing the binary Unity adapter 1.0.0. It owns one rewarded placement and
releases native resources when closed, replaced or disposed.

Initialize `MelvadAds` once with your account's `MelvadConfiguration` and actual
CMP-derived `PrivacyContext`, as described in the
[integration guide](https://melvad.com/developers?lang=en#unity-sdk).
Then retain a `RewardedController` in the scene that owns the placement:

- Subscribe to `Ready` to enable your Show button.
- Call `Load` with your account's `AdPlacement` after consent permits a request.
- Call `Show` from the player's action, checking `CanShow` first.
- Handle `NoFill`, `Failed` and `Closed` to update the game's UI.
- Handle `RewardEarned` for the local reward condition. A verified server balance
  still comes from your backend when SSV is enabled.
- Call `Dispose` in the owning scene object's `OnDestroy`.

Run all calls on Unity's main thread. The game owns pause, sound and orientation.
The helper does not initialize advertising, load or show ads automatically.

This source is an integration helper. Adapter and SDK implementations remain in
the compiled package.
