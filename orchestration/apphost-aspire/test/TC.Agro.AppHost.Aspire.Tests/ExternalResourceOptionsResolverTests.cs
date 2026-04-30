using Microsoft.Extensions.Configuration;
using TC.Agro.AppHost.Aspire.Configuration;
using TC.Agro.SharedKernel.Infrastructure.Caching.Provider;
using TC.Agro.SharedKernel.Infrastructure.Database;
using TC.Agro.SharedKernel.Infrastructure.MessageBroker;
using Xunit;

namespace TC.Agro.AppHost.Aspire.Tests;

public class ExternalResourceOptionsResolverTests
{
    [Fact]
    public void ResolveRedisOptions_WhenConnectionStringExists_PrefersConnectionStringValues()
    {
        var config = BuildConfig(new Dictionary<string, string?>
        {
            ["ConnectionStrings:redis"] = "10.20.30.40:6380,password=secret,ssl=true"
        });

        var section = new RedisOptions
        {
            Host = "section-host",
            Port = 6379,
            Password = "section-password",
            Secure = false,
            InstanceName = "tc-agro"
        };

        var resolved = ExternalResourceOptionsResolver.ResolveRedisOptions(config, section);

        Assert.Equal("10.20.30.40", resolved.Host);
        Assert.Equal(6380, resolved.Port);
        Assert.Equal("secret", resolved.Password);
        Assert.True(resolved.Secure);
        Assert.Equal("tc-agro", resolved.InstanceName);
    }

    [Fact]
    public void ResolveRabbitMqOptions_WhenConnectionStringExists_PrefersConnectionStringValues()
    {
        var config = BuildConfig(new Dictionary<string, string?>
        {
            ["ConnectionStrings:rabbitmq"] = "amqp://user1:pass1@mq-host:5673/custom-vhost"
        });

        var section = new RabbitMqOptions
        {
            Host = "section-host",
            Port = 5672,
            VirtualHost = "/",
            UserName = "section-user",
            Password = "section-password"
        };

        var resolved = ExternalResourceOptionsResolver.ResolveRabbitMqOptions(config, section);

        Assert.Equal("mq-host", resolved.Host);
        Assert.Equal(5673, resolved.Port);
        Assert.Equal("custom-vhost", resolved.VirtualHost);
        Assert.Equal("user1", resolved.UserName);
        Assert.Equal("pass1", resolved.Password);
    }

    [Fact]
    public void ResolvePostgresOptions_WhenConnectionStringExists_PrefersConnectionStringValues()
    {
        var config = BuildConfig(new Dictionary<string, string?>
        {
            ["ConnectionStrings:postgres"] = "Host=pg-host;Port=5433;Database=appdb;Username=userpg;Password=passpg;SearchPath=tenant;SSL Mode=Require;Trust Server Certificate=true"
        });

        var section = new PostgresOptions
        {
            Host = "section-host",
            Port = 5432,
            Database = "section-db",
            UserName = "section-user",
            Password = "section-password",
            Schema = "public",
            SslMode = "Disable",
            TrustServerCertificate = false
        };

        var resolved = ExternalResourceOptionsResolver.ResolvePostgresOptions(config, section);

        Assert.Equal("pg-host", resolved.Host);
        Assert.Equal(5433, resolved.Port);
        Assert.Equal("appdb", resolved.Database);
        Assert.Equal("userpg", resolved.UserName);
        Assert.Equal("passpg", resolved.Password);
        Assert.Equal("tenant", resolved.Schema);
        Assert.Equal("Require", resolved.SslMode);
        Assert.True(resolved.TrustServerCertificate);
    }

    [Fact]
    public void ResolveOptions_WhenConnectionStringIsMissing_FallsBackToSectionValues()
    {
        var config = BuildConfig(new Dictionary<string, string?>());

        var redisSection = new RedisOptions { Host = "redis-section", Port = 6379, InstanceName = "tc-agro" };
        var rabbitSection = new RabbitMqOptions { Host = "rabbit-section", Port = 5672, VirtualHost = "/" };
        var postgresSection = new PostgresOptions { Host = "pg-section", Port = 5432, Database = "db-section" };

        var redisResolved = ExternalResourceOptionsResolver.ResolveRedisOptions(config, redisSection);
        var rabbitResolved = ExternalResourceOptionsResolver.ResolveRabbitMqOptions(config, rabbitSection);
        var postgresResolved = ExternalResourceOptionsResolver.ResolvePostgresOptions(config, postgresSection);

        Assert.Equal("redis-section", redisResolved.Host);
        Assert.Equal("rabbit-section", rabbitResolved.Host);
        Assert.Equal("pg-section", postgresResolved.Host);
        Assert.Equal("db-section", postgresResolved.Database);
    }

    private static IConfiguration BuildConfig(IDictionary<string, string?> values)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
    }
}
