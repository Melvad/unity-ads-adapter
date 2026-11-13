using System;
using Melvad.Ads;

public sealed class RewardedController : IDisposable
{
    private RewardedAd ad;
    private bool disposed;

    public bool CanShow { get { return ad != null && ad.CanShow; } }

    public event Action Ready;
    public event Action RewardEarned;
    public event Action NoFill;
    public event Action Closed;
    public event Action<AdError> Failed;

    // Call after MelvadAds.Initialize, on the Unity main thread.
    public void Load(AdPlacement placement, RewardVerification verification = null)
    {
        if (disposed) throw new ObjectDisposedException(nameof(RewardedController));
        if (placement == null) throw new ArgumentNullException(nameof(placement));
        ReleaseAd();
        ad = MelvadAds.CreateRewardedAd();
        ad.Loaded += OnReady;
        ad.RewardEarned += OnRewardEarned;
        ad.NoFill += OnNoFill;
        ad.LoadFailed += OnFailed;
        ad.ShowFailed += OnFailed;
        ad.Closed += OnClosed;
        ad.Load(placement, verification);
    }

    // Call only in response to the player's Show action.
    public void Show()
    {
        if (CanShow) ad.Show();
    }

    private void OnReady()
    {
        Ready?.Invoke();
    }

    private void OnRewardEarned()
    {
        RewardEarned?.Invoke();
    }

    private void OnNoFill()
    {
        ReleaseAd();
        NoFill?.Invoke();
    }

    private void OnFailed(AdError error)
    {
        ReleaseAd();
        Failed?.Invoke(error);
    }

    private void OnClosed()
    {
        ReleaseAd();
        Closed?.Invoke();
    }

    private void ReleaseAd()
    {
        if (ad == null) return;
        ad.Loaded -= OnReady;
        ad.RewardEarned -= OnRewardEarned;
        ad.NoFill -= OnNoFill;
        ad.LoadFailed -= OnFailed;
        ad.ShowFailed -= OnFailed;
        ad.Closed -= OnClosed;
        ad.Dispose();
        ad = null;
    }

    public void Dispose()
    {
        ReleaseAd();
        disposed = true;
        Ready = RewardEarned = NoFill = Closed = null;
        Failed = null;
    }
}
