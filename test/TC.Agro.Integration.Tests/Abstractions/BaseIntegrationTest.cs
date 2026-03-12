namespace TC.Agro.Integration.Tests.Abstractions;

[Collection(nameof(CrossServiceIntegrationTestCollection))]
public abstract class BaseIntegrationTest : IAsyncLifetime
{
    protected BaseIntegrationTest(CrossServiceIntegrationFixture fixture)
    {
        Fixture = fixture;
    }

    protected CrossServiceIntegrationFixture Fixture { get; }

    public virtual ValueTask InitializeAsync()
        => new(Fixture.ResetStateAsync(TestContext.Current.CancellationToken));

    public virtual ValueTask DisposeAsync() => ValueTask.CompletedTask;
}