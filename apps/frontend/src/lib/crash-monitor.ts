import { metrics } from "@opentelemetry/api";

/**
 * Monitor para capturar e registrar falhas críticas do processo Node.js (Frontend Server).
 * Incrementa um contador de "process.crashes" antes de encerrar.
 */
export function setupCrashMonitor() {
  if (typeof window !== "undefined") return;

  const meter = metrics.getMeter("frontend-server-ops");
  const crashCounter = meter.createCounter("process.crashes", {
    description: "Total number of unhandled exceptions causing process exit",
  });

  const handleFatalError = async (error: Error, type: string) => {
    console.error(`[FATAL ERROR] ${type}:`, error);

    // Incrementa a métrica de crash
    crashCounter.add(1, {
      type,
      error: error.name,
      message: error.message.slice(0, 100),
    });

    // Tenta garantir que os dados sejam enviados antes de morrer
    // O SDK de métricas costuma ter um PeriodicExportingMetricReader
    // Em produção, isso pode ser difícil de garantir se não for síncrono,
    // mas o log acima já ajuda no diagnóstico.

    console.log("[FATAL ERROR] Graceful shutdown initiated...");

    // Aguarda um pouco para o exporter tentar enviar (melhor esforço)
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  };

  process.on("uncaughtException", (error) =>
    handleFatalError(error, "uncaughtException")
  );
  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    handleFatalError(error, "unhandledRejection");
  });
}
