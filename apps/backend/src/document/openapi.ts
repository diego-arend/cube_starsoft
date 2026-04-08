const examples = {
  UploadRequest: {
    value: {
      filename: "invoice.pdf",
      contentType: "application/pdf",
      dataBase64: "JVBERi0xLjQKJ... (truncated base64 PDF)",
    },
  },

  DocumentResponseExample: {
    value: {
      id: "d-uuid",
      key: "user-id/uuid.pdf",
      ownerId: "user-id",
      originalFilename: "invoice.pdf",
      contentType: "application/pdf",
      size: 12345,
      metadata: {},
      scanStatus: "clean",
    },
  },
  UploadResponseExample: {
    value: {
      id: "d-uuid",
      key: "user-id/uuid.pdf",
      originalFilename: "invoice.pdf",
      contentType: "application/pdf",
      size: 12345,
    },
  },
  DeleteResponseExample: { value: { success: true } },
  ErrorExample_FileTooLarge: {
    value: {
      statusCode: 400,
      message: "File too large",
      error: "Bad Request",
    },
  },
  ErrorExample_NotFound: {
    value: {
      statusCode: 404,
      message: "Object not found",
      error: "Not Found",
    },
  },
  ErrorExample_InvalidPdf: {
    value: {
      statusCode: 400,
      message: "Uploaded file is not a valid PDF",
      error: "Bad Request",
    },
  },
  ErrorExample_FileRejected: {
    value: {
      statusCode: 400,
      message: "Uploaded file failed validation checks",
      error: "Bad Request",
    },
  },
  ErrorExample_NotAllowed: {
    value: { statusCode: 400, message: "Not allowed", error: "Bad Request" },
  },
};

const schemas: Record<string, any> = {
  UploadBody: {
    oneOf: [
      {
        type: "object",
        properties: {
          filename: { type: "string", example: "invoice.pdf" },
          contentType: { type: "string", example: "application/pdf" },
          dataBase64: { type: "string", example: "JVBERi0xLjQKJ..." },
        },
        required: ["filename", "dataBase64"],
      },
      {
        type: "object",
        properties: {
          file: { type: "string", format: "binary" },
          filename: { type: "string", example: "invoice.pdf" },
          contentType: { type: "string", example: "application/pdf" },
        },
        required: ["file"],
      },
    ],
  },

  UploadResponse: {
    type: "object",
    properties: {
      id: { type: "string", example: "d-uuid" },
      key: { type: "string", example: "user-id/uuid.pdf" },
      originalFilename: { type: "string", example: "invoice.pdf" },
      contentType: { type: "string", example: "application/pdf" },
      size: { type: "number", example: 12345 },
    },
  },

  DocumentResponse: {
    type: "object",
    properties: {
      id: { type: "string", example: "d-uuid" },
      key: { type: "string", example: "user-id/uuid.pdf" },
      ownerId: { type: "string", example: "user-id" },
      originalFilename: { type: "string", example: "invoice.pdf" },
      contentType: { type: "string", example: "application/pdf" },
      size: { type: "number", example: 12345 },
      metadata: { type: "object", example: {} },
      scanStatus: { type: "string", example: "clean" },
      createdAt: { type: "string", example: new Date().toISOString() },
    },
  },

  DocumentListItem: {
    type: "object",
    properties: {
      id: { type: "string", example: "d-uuid" },
      key: { type: "string", example: "user-id/uuid.pdf" },
      ownerId: { type: "string", example: "user-id" },
      originalFilename: { type: "string", example: "invoice.pdf" },
      contentType: { type: "string", example: "application/pdf" },
      size: { type: "number", example: 12345 },
      metadata: { type: "object", example: {} },
      createdAt: { type: "string", example: new Date().toISOString() },
      scanStatus: { type: "string", example: "clean" },
    },
  },
};

const DocumentOpenApiComponents = {
  schemas,
  examples,
};

export default DocumentOpenApiComponents;
