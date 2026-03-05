using NetArchTest.Rules;

namespace TC.Agro.Architecture.Tests.Layers;

public sealed class LayerDependencyTests : BaseTest
{
    [Fact]
    public void IdentityApplication_ShouldNotDependOnIdentityServiceAdapter()
    {
        var result = Types
            .InAssembly(IdentityApplicationAssembly)
            .ShouldNot()
            .HaveDependencyOn("TC.Agro.Identity.Service")
            .GetResult();

        result.IsSuccessful.ShouldBeTrue();
    }

    [Fact]
    public void FarmApplication_ShouldNotDependOnFarmServiceAdapter()
    {
        var result = Types
            .InAssembly(FarmApplicationAssembly)
            .ShouldNot()
            .HaveDependencyOn("TC.Agro.Farm.Service")
            .GetResult();

        result.IsSuccessful.ShouldBeTrue();
    }

    [Fact]
    public void IdentityDomain_ShouldNotDependOnApplicationOrServiceLayers()
    {
        var result = Types
            .InAssembly(IdentityDomainAssembly)
            .ShouldNot()
            .HaveDependencyOnAny("TC.Agro.Identity.Application", "TC.Agro.Identity.Service")
            .GetResult();

        result.IsSuccessful.ShouldBeTrue();
    }

    [Fact]
    public void FarmDomain_ShouldNotDependOnApplicationOrServiceLayers()
    {
        var result = Types
            .InAssembly(FarmDomainAssembly)
            .ShouldNot()
            .HaveDependencyOnAny("TC.Agro.Farm.Application", "TC.Agro.Farm.Service")
            .GetResult();

        result.IsSuccessful.ShouldBeTrue();
    }
}