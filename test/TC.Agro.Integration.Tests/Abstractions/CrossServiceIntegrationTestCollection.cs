namespace TC.Agro.Integration.Tests.Abstractions;

[CollectionDefinition(nameof(CrossServiceIntegrationTestCollection), DisableParallelization = true)]
public sealed class CrossServiceIntegrationTestCollection : ICollectionFixture<CrossServiceIntegrationFixture>;