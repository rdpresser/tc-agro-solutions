namespace TC.Agro.Integration.Tests.Abstractions;

/// <summary>
/// Backward-compatible fixture name for existing integration tests.
/// New tests can depend directly on BreakGlassE2EFixture.
/// </summary>
public sealed class CrossServiceIntegrationFixture : BreakGlassE2EFixture
{
}
