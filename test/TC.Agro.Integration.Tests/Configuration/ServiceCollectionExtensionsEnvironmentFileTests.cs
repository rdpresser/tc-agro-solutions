using SharedKernelServiceCollectionExtensions = TC.Agro.SharedKernel.Extensions.ServiceCollectionExtensions;

namespace TC.Agro.Integration.Tests.Configuration;

public sealed class ServiceCollectionExtensionsEnvironmentFileTests
{
    [Fact]
    public void LoadEnvironmentFiles_WithExplicitDirectory_LoadsBaseAndEnvironmentSpecificValues()
    {
        var baseVariable = $"TC_AGRO_TEST_BASE_{Guid.NewGuid():N}";
        var overrideVariable = $"TC_AGRO_TEST_OVERRIDE_{Guid.NewGuid():N}";
        var environmentOnlyVariable = $"TC_AGRO_TEST_ENV_ONLY_{Guid.NewGuid():N}";

        using var scope = new EnvironmentVariableScope(baseVariable, overrideVariable, environmentOnlyVariable);
        var environmentDirectory = CreateTempDirectory();

        try
        {
            File.WriteAllText(
                Path.Combine(environmentDirectory, ".env"),
                string.Join(
                    Environment.NewLine,
                    $"{baseVariable}=base-value",
                    $"{overrideVariable}=base-value"));

            File.WriteAllText(
                Path.Combine(environmentDirectory, ".env.development"),
                string.Join(
                    Environment.NewLine,
                    $"{overrideVariable}=development-value",
                    $"{environmentOnlyVariable}=development-value"));

            SharedKernelServiceCollectionExtensions.LoadEnvironmentFiles("Development", environmentDirectory);

            Environment.GetEnvironmentVariable(baseVariable).ShouldBe("base-value");
            Environment.GetEnvironmentVariable(overrideVariable).ShouldBe("development-value");
            Environment.GetEnvironmentVariable(environmentOnlyVariable).ShouldBe("development-value");
        }
        finally
        {
            Directory.Delete(environmentDirectory, recursive: true);
        }
    }

    [Fact]
    public void LoadEnvironmentFiles_WhenEnvironmentSpecificLoadingIsDisabled_LoadsOnlyBaseValues()
    {
        var baseVariable = $"TC_AGRO_TEST_BASE_ONLY_{Guid.NewGuid():N}";
        var overrideVariable = $"TC_AGRO_TEST_NO_ENV_OVERRIDE_{Guid.NewGuid():N}";
        var environmentOnlyVariable = $"TC_AGRO_TEST_DISABLED_ENV_ONLY_{Guid.NewGuid():N}";

        using var scope = new EnvironmentVariableScope(baseVariable, overrideVariable, environmentOnlyVariable);
        var environmentDirectory = CreateTempDirectory();

        try
        {
            File.WriteAllText(
                Path.Combine(environmentDirectory, ".env"),
                string.Join(
                    Environment.NewLine,
                    $"{baseVariable}=base-value",
                    $"{overrideVariable}=base-value"));

            File.WriteAllText(
                Path.Combine(environmentDirectory, ".env.development"),
                string.Join(
                    Environment.NewLine,
                    $"{overrideVariable}=development-value",
                    $"{environmentOnlyVariable}=development-value"));

            SharedKernelServiceCollectionExtensions.LoadEnvironmentFiles(
                "Development",
                environmentDirectory,
                loadEnvironmentSpecificFile: false);

            Environment.GetEnvironmentVariable(baseVariable).ShouldBe("base-value");
            Environment.GetEnvironmentVariable(overrideVariable).ShouldBe("base-value");
            Environment.GetEnvironmentVariable(environmentOnlyVariable).ShouldBeNull();
        }
        finally
        {
            Directory.Delete(environmentDirectory, recursive: true);
        }
    }

    private static string CreateTempDirectory()
    {
        var directory = Path.Combine(
            Path.GetTempPath(),
            "tc-agro-integration-tests",
            Guid.NewGuid().ToString("N"));

        Directory.CreateDirectory(directory);
        return directory;
    }

    private sealed class EnvironmentVariableScope(params string[] variableNames) : IDisposable
    {
        private readonly Dictionary<string, string?> _originalValues = variableNames.ToDictionary(
            variableName => variableName,
            Environment.GetEnvironmentVariable);

        public void Dispose()
        {
            foreach (var (variableName, value) in _originalValues)
            {
                Environment.SetEnvironmentVariable(variableName, value);
            }
        }
    }
}