# Melvad Ads for Unity

Binary Unity adapter for Melvad advertising on Android and iOS through one C# API.
The current **1.0.0** release supports rewarded video and includes native SDKs 1.0.3.

## Implementation languages

| Component | Languages |
| --- | --- |
| Unity API and Editor tooling | C# |
| Android bridge | Java |
| iOS bridge | Objective-C++ |
| Native Android SDK | Kotlin |
| Native iOS SDK | Swift |
| Web renderers | TypeScript and JavaScript; shipped as JavaScript |

The GitHub language indicator describes the [C# integration example](Examples/).
The compiled Unity package and its native interfaces are excluded from that chart.
Its percentages describe the public example code, not the private adapter or SDK
implementations.

## Downloads

Download the [.tgz or .unitypackage release](https://github.com/Melvad/unity-ads-adapter/releases/tag/v1.0.0).
Use Unity Package Manager for the tarball, or Assets → Import Package for the unitypackage.
Install one package format per project.

## Documentation

- [Integration guide](https://melvad.com/developers?lang=en#unity-sdk)
- [Package installation and C# usage](Packages/com.melvad.ads/README.md)

Tested profile: Unity 6000.6.9f1, IL2CPP ARM64, Android API 29+, iOS 16+.
Native dependency setup is automatic. Version 1.0.0 supports rewarded video.

## License

[Melvad SDK License](LICENSE). Third-party notices are included in
[the package](Packages/com.melvad.ads/Licenses).
This repository distributes compiled libraries and their required native interfaces.
