using System.Reflection;
using TC.Agro.Contracts.Events.Identity;
using TC.Agro.Farm.Application.MessageBrokerHandlers;
using TC.Agro.Farm.Domain.Snapshots;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Identity.Domain.Aggregates;

namespace TC.Agro.Architecture.Tests;

public abstract class BaseTest
{
    protected static readonly Assembly ContractsAssembly = typeof(UserCreatedIntegrationEvent).Assembly;
    protected static readonly Assembly IdentityDomainAssembly = typeof(UserAggregate).Assembly;
    protected static readonly Assembly IdentityApplicationAssembly = typeof(CreateUserCommand).Assembly;
    protected static readonly Assembly FarmDomainAssembly = typeof(OwnerSnapshot).Assembly;
    protected static readonly Assembly FarmApplicationAssembly = typeof(OwnerSnapshotHandler).Assembly;
}