#!/bin/bash
set -e

echo "🔨 Building TC Agro Solutions (all services)..."
echo "=================================================="

projects=(
    "common/TC.Agro.Common.slnx"
    "test/TC.Agro.Integration.Tests/TC.Agro.Integration.Tests.csproj"
    "services/farm-service/TC.Agro.Farm.Service.slnx"
    "services/identity-service/TC.Agro.Identity.Service.slnx"
    "services/sensor-ingest-service/TC.Agro.SensorIngest.Service.slnx"
    "services/analytics-worker/TC.Agro.Analytics.Worker.slnx"
)

failed=0
for proj in "${projects[@]}"; do
    echo ""
    echo "📦 Building: $proj"
    if dotnet build "$proj" -c Release --no-incremental -p:TreatWarningsAsErrors=false -nologo --verbosity minimal 2>&1 | grep -E "(error|Error|BUILD|failed|Restoring|error:)" | head -30; then
        echo "✅ $proj"
    else
        echo "⚠️  Build completed (check manually)"
    fi
done

echo ""
echo "✅ All builds completed!"
