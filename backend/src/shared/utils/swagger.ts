import type { Request, Response } from "express"

export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "JobsForWomen.info API Documentation",
    version: "1.0.0",
    description: "Production-ready REST API Backend services for JobsForWomen.info matching monolithic modules configurations.",
  },
  servers: [
    {
      url: "http://localhost:5000/api/v1",
      description: "Development Server",
    },
    {
      url: "https://api.jobsforwomen.info/api/v1",
      description: "Production Server",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your JWT Access Token. Header: Authorization: Bearer <token>",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Error description details." },
          error: { type: "object", nullable: true },
        },
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
  ],
  paths: {
    "/auth/register/candidate": {
      post: {
        tags: ["Authentication"],
        summary: "Register a new candidate account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "fullName"],
                properties: {
                  email: { type: "string", format: "email", example: "candidate@jfw.info" },
                  password: { type: "string", example: "pass1234" },
                  fullName: { type: "string", example: "Sarah Connor" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Registered successfully" },
          400: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Log in with email & password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "candidate@jfw.info" },
                  password: { type: "string", example: "pass1234" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Session started" },
          401: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
    "/candidates/dashboard": {
      get: {
        tags: ["Candidate Module"],
        summary: "Fetch Candidate Dashboard stats",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Dashboard stats returned" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/recruiters/dashboard": {
      get: {
        tags: ["Recruiter Module"],
        summary: "Fetch Recruiter Dashboard metrics",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Dashboard stats returned" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/admins/dashboard": {
      get: {
        tags: ["Admin Module"],
        summary: "Fetch Admin Administration Dashboard",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Dashboard analytics returned" },
          403: { description: "Forbidden" },
        },
      },
    },
  },
}

export const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>JobsForWomen API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -grow-y; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/api-docs.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.presets.apis
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
`

export function serveSwaggerJson(req: Request, res: Response) {
  res.json(openApiSpec)
}

export function serveSwaggerUi(req: Request, res: Response) {
  res.send(swaggerHtml)
}
