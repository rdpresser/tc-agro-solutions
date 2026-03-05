using NetArchTest.Rules;
using TC.Agro.Contracts.Events;
using Wolverine;

namespace TC.Agro.Architecture.Tests.Messaging;

public sealed class MessagingContractTests : BaseTest
{
    [Fact]
    public void IdentityIntegrationEvents_ShouldInheritBaseIntegrationEvent()
    {
        var result = Types
            .InAssembly(ContractsAssembly)
            .That()
            .ResideInNamespace("TC.Agro.Contracts.Events.Identity")
            .And()
            .HaveNameEndingWith("IntegrationEvent")
            .Should()
            .Inherit(typeof(BaseIntegrationEvent))
            .GetResult();

        result.IsSuccessful.ShouldBeTrue();
    }

    [Fact]
    public void FarmMessageBrokerHandlers_ShouldImplementIWolverineHandler()
    {
        var result = Types
            .InAssembly(FarmApplicationAssembly)
            .That()
            .ResideInNamespace("TC.Agro.Farm.Application.MessageBrokerHandlers")
            .Should()
            .ImplementInterface(typeof(IWolverineHandler))
            .GetResult();

        result.IsSuccessful.ShouldBeTrue();
    }
}