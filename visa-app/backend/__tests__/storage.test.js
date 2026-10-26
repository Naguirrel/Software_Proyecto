const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const express = require("express");
const request = require("supertest");

const mockValidateR2Config = jest.fn(() => {
  throw new Error("Missing R2 environment variables: R2_BUCKET");
});

jest.mock("../r2", () => ({
  validateR2Config: mockValidateR2Config,
  uploadBufferToR2: jest.fn(),
  deleteObjectFromR2: jest.fn(),
}));

describe("development local document storage", () => {
  let directory;
  let storage;

  beforeEach(async () => {
    jest.resetModules();
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "visa-app-storage-"));
    process.env.LOCAL_UPLOAD_DIR = directory;
    process.env.NODE_ENV = "test";
    storage = require("../storage");
  });

  afterEach(async () => {
    delete process.env.LOCAL_UPLOAD_DIR;
    delete process.env.LOCAL_STORAGE_FALLBACK;
    process.env.NODE_ENV = "test";
    await fs.rm(directory, { recursive: true, force: true });
  });

  test("conserva, descarga y elimina el archivo local después de recargar el módulo", async () => {
    const uploaded = await storage.uploadStoredFile(
      {
        originalname: "pasaporte prueba.pdf",
        buffer: Buffer.from("contenido"),
      },
      { baseUrl: "http://backend.example.test" }
    );

    expect(uploaded.provider).toBe("local");
    expect(uploaded.url).toContain("http://backend.example.test/local-files/");
    const storedPath = path.join(directory, path.basename(uploaded.key));
    await expect(fs.readFile(storedPath, "utf8"))
      .resolves.toBe("contenido");

    jest.resetModules();
    const reloadedStorage = require("../storage");
    await expect(fs.readFile(storedPath, "utf8")).resolves.toBe("contenido");

    const downloadApp = express();
    downloadApp.use("/local-files", express.static(reloadedStorage.LOCAL_STORAGE_DIR));
    const downloadPath = new URL(uploaded.url).pathname;
    const download = await request(downloadApp).get(downloadPath);
    expect(download.status).toBe(200);
    expect(download.body.toString()).toBe("contenido");

    await reloadedStorage.deleteStoredFile(uploaded.key);
    await expect(fs.access(storedPath)).rejects.toThrow();
    expect((await request(downloadApp).get(downloadPath)).status).toBe(404);
  });

  test("rechaza el fallback local en producción cuando no se habilita explícitamente", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.LOCAL_STORAGE_FALLBACK;

    await expect(storage.uploadStoredFile(
      { originalname: "avatar.png", buffer: Buffer.from("imagen") },
      { baseUrl: "http://backend.example.test" }
    )).rejects.toThrow("Missing R2 environment variables");
  });

  test("permite el volumen local de Docker cuando el fallback está habilitado explícitamente", async () => {
    process.env.NODE_ENV = "production";
    process.env.LOCAL_STORAGE_FALLBACK = "true";

    const uploaded = await storage.uploadStoredFile(
      { originalname: "avatar.png", buffer: Buffer.from("imagen") },
      { baseUrl: "http://backend.example.test" }
    );

    expect(uploaded).toEqual(expect.objectContaining({ provider: "local" }));
    await expect(fs.readFile(path.join(directory, path.basename(uploaded.key)), "utf8"))
      .resolves.toBe("imagen");
  });
});
