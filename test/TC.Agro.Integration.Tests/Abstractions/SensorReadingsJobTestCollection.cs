namespace TC.Agro.Integration.Tests.Abstractions;

/// <summary>
/// Test fixture with the SimulatedSensorReadingsJob enabled at a short interval.
/// Used exclusively for job lifecycle E2E tests that require Quartz to fire.
/// </summary>
public sealed class SensorReadingsJobIntegrationFixture : BreakGlassE2EFixture
{
    protected override bool EnableSensorReadingsJob => true;

    /// <summary>
    /// 5-second interval keeps tests fast while still exercising the full Quartz schedule.
    /// </summary>
    protected override int SensorReadingsJobIntervalSeconds => 5;
}

[CollectionDefinition(nameof(SensorReadingsJobTestCollection), DisableParallelization = true)]
public sealed class SensorReadingsJobTestCollection : ICollectionFixture<SensorReadingsJobIntegrationFixture>
{
}
