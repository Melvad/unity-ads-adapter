# Distributed interfaces and runtime reference

`Android/` and `iOS/` contain byte-for-byte copies of public headers, Swift module
interfaces and JavaScript/HTML runtime files from the native SDK binaries bundled
with Melvad Ads for Unity 1.0.0. The original packaged binaries stay in
`Packages/com.melvad.ads/`; installation archives and tags are unchanged.

GitHub can inspect these distributed text files alongside the C#, Kotlin and Java
API signatures in `api/`, as it does for the unpacked iOS SDK. Language percentages
describe the public distribution's text and interfaces, including native dependencies;
they do not measure the private implementation source. TypeScript is shipped as
compiled JavaScript. Generated interface files may occur in multiple platform slices.

Original notices are preserved in
[`../Packages/com.melvad.ads/Licenses`](../Packages/com.melvad.ads/Licenses).
`manifest.json` records the origin and SHA-256 of every exported file. Private C#,
Kotlin, Java, Objective-C++ and TypeScript implementation projects are not included.
