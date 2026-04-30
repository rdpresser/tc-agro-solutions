using Microsoft.Extensions.Configuration;
using TC.Agro.AppHost.Aspire.Configuration;
using Xunit;

namespace TC.Agro.AppHost.Aspire.Tests;

public class ExternalResourceValidatorTests
{
    [Fact]
    public void EnsureConfigured_WhenSectionsArePresent_DoesNotThrow()
    {
        var config = BuildConfig(new Dictionary<string, string?>
        {
            ["Cache:Redis:Host"] = "192.168.0.220",
            ["Messaging:RabbitMQ:Host"] = "192.168.0.230",
            ["Database:Postgres:Host"] = "192.168.0.210"
        });

        var exception = Record.Exception(() => ExternalResourceValidator.EnsureConfigured(config));

        Assert.Null(exception);
    }

    [Fact]
    public void EnsureConfigured_WhenConnectionStringsArePresent_DoesNotThrow()
    {
        var config = BuildConfig(new Dictionary<string, string?>
        {
            ["ConnectionStrings:redis"] = "192.168.0.220:6379,password=devuser,ssl=false",
            ["ConnectionStrings:rabbitmq"] = "amqp://devuser:devuser@192.168.0.230:5672/%2F",
            ["ConnectionStrings:postgres"] = "Host=192.168.0.210;Port=5432;Database=postgres;Username=devuser;Password=devuser"
        });

        var exception = Record.Exception(() => ExternalResourceValidator.EnsureConfigured(config));

        Assert.Null(exception);
    }

    [Fact]
    public void EnsureConfigured_WhenRabbitMqIsMissing_ThrowsWithActionableMessage()
    {
        var config = BuildConfig(new Dictionary<string, string?>
        {
            ["ConnectionStrings:redis"] = "192.168.0.220:6379,password=devuser,ssl=false",
            ["ConnectionStrings:postgres"] = "Host=192.168.0.210;Port=5432;Database=postgres;Username=devuser;Password=devuser"
        });

        var ex = Assert.Throws<InvalidOperationException>(() => ExternalResourceValidator.EnsureConfigured(config));

        Assert.Contains("ConnectionStrings:rabbitmq", ex.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("redis", "ConnectionStrings:redis")]
    [InlineData("rabbitmq", "ConnectionStrings:rabbitmq")]
    [InlineData("postgres", "ConnectionStrings:postgres")]
    public void EnsureConfigured_WhenMandatoryResourceIsMissing_ThrowsActionableMessage(string missingResource, string expectedKey)
    {
        var values = new Dictionary<string, string?>
        {
            ["ConnectionStrings:redis"] = "192.168.0.220:6379,password=devuser,ssl=false",
            ["ConnectionStrings:rabbitmq"] = "amqp://devuser:devuser@192.168.0.230:5672/%2F",
            ["ConnectionStrings:postgres"] = "Host=192.168.0.210;Port=5432;Database=postgres;Username=devuser;Password=devuser"
        };

        values.Remove($"ConnectionStrings:{missingResource}");

        var config = BuildConfig(values);

        var ex = Assert.Throws<InvalidOperationException>(() => ExternalResourceValidator.EnsureConfigured(config));

        Assert.Contains(expectedKey, ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void EnsureConfigured_WhenMixedSourceIsUsed_DoesNotThrow()
    {
        var config = BuildConfig(new Dictionary<string, string?>
        {
            ["ConnectionStrings:redis"] = "192.168.0.220:6379,password=devuser,ssl=false",
            ["Messaging:RabbitMQ:Host"] = "192.168.0.230",
            ["ConnectionStrings:postgres"] = "Host=192.168.0.210;Port=5432;Database=postgres;Username=devuser;Password=devuser"
        });

        var exception = Record.Exception(() => ExternalResourceValidator.EnsureConfigured(config));

        Assert.Null(exception);
    }

    private static IConfiguration BuildConfig(IDictionary<string, string?> values)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
    }
}
