namespace TC.Agro.Integration.Tests.Abstractions;

[CollectionDefinition(nameof(IntegrationTestCollection), DisableParallelization = true)]
public sealed class IntegrationTestCollection : ICollectionFixture<IdentityFarmIntegrationFixture>;