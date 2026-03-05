namespace TC.Agro.Integration.Tests.Abstractions;

[Collection(nameof(IntegrationTestCollection))]
public abstract class BaseIntegrationTest
{
    protected BaseIntegrationTest(IdentityFarmIntegrationFixture fixture)
    {
        Fixture = fixture;
    }

    protected IdentityFarmIntegrationFixture Fixture { get; }
}