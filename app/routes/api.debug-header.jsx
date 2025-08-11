import { json } from "@remix-run/node";

// Debug endpoint to check headers and CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
  "Access-Control-Allow-Credentials": "true",
};

export const loader = ({ request }) => {
  console.log("🔍 Debug headers request received");
  
  const headers = Object.fromEntries(request.headers.entries());
  const url = new URL(request.url);
  
  return json(
    {
      method: request.method,
      url: request.url,
      pathname: url.pathname,
      origin: headers.origin || 'No origin header',
      referer: headers.referer || 'No referer header',
      userAgent: headers['user-agent'] || 'No user-agent header',
      authorization: headers.authorization ? 'Present' : 'Missing',
      contentType: headers['content-type'] || 'No content-type header',
      allHeaders: headers,
      timestamp: new Date().toISOString(),
    },
    { 
      status: 200,
      headers: corsHeaders 
    }
  );
};

export const action = ({ request }) => {
  console.log("🔍 Debug headers POST request received");
  
  const headers = Object.fromEntries(request.headers.entries());
  const url = new URL(request.url);
  
  return json(
    {
      method: request.method,
      url: request.url,
      pathname: url.pathname,
      origin: headers.origin || 'No origin header',
      referer: headers.referer || 'No referer header',
      userAgent: headers['user-agent'] || 'No user-agent header',
      authorization: headers.authorization ? 'Present' : 'Missing',
      contentType: headers['content-type'] || 'No content-type header',
      allHeaders: headers,
      timestamp: new Date().toISOString(),
      message: "Debug endpoint working correctly!",
    },
    { 
      status: 200,
      headers: corsHeaders 
    }
  );
};