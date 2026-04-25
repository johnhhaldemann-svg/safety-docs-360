export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { registerNodeProcessHandlers } = await import("./instrumentation.node");
  registerNodeProcessHandlers();
}
