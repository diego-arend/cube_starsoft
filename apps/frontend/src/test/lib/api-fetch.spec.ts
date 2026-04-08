import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, setApiFetchHooks } from "../../lib/api-fetch";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setApiFetchHooks({});
  });

  afterEach(() => {
    setApiFetchHooks({});
  });

  it("should call onStart and onEnd hooks", async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    setApiFetchHooks({ onStart, onEnd });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await apiFetch("https://api.example.com/data");

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/data",
      expect.objectContaining({ headers: expect.any(Headers) })
    );
  });

  it("should call onEnd even if fetch fails", async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    setApiFetchHooks({ onStart, onEnd });

    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    await expect(apiFetch("https://api.example.com/data")).rejects.toThrow(
      "Network error"
    );

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("should return the response from fetch", async () => {
    const mockResponse = { ok: true, status: 200 } as Response;
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

    const response = await apiFetch("https://api.example.com/data");
    expect(response).toBe(mockResponse);
  });
});
