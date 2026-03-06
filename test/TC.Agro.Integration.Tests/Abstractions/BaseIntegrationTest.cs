namespace TC.Agro.Integration.Tests.Abstractions;

[Collection(nameof(CrossServiceIntegrationTestCollection))]
public abstract class BaseIntegrationTest
{
    protected BaseIntegrationTest(CrossServiceIntegrationFixture fixture)
    {
        Fixture = fixture;
    }

    protected CrossServiceIntegrationFixture Fixture { get; }
}