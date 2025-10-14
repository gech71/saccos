
import { NextRequest, NextResponse } from 'next/server';
import { validateNibToken, createSignature } from '@/app/minapp/actions';

/**
 * API route to handle callback notifications from NIBtera.
 * NIBtera will send a POST request to this endpoint after a transaction attempt.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log('--- NIBtera Callback Received ---');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Payload:', JSON.stringify(body, null, 2));

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Callback Error: Missing or invalid Authorization header.');
      return NextResponse.json({ success: false, message: 'Authorization header is missing or malformed.' }, { status: 401 });
    }
    const token = authHeader.substring(7);

    // STEP 01 (re-validated): Validate the token
    const validationResult = await validateNibToken(token);
    if (validationResult.error) {
        console.error('Callback Error: Token validation failed.', validationResult.error);
        return NextResponse.json({ success: false, message: `Token validation failed: ${validationResult.error}` }, { status: 401 });
    }

    // STEP 05: Verify the signature
    const { signature: receivedSignature, ...payloadToVerify } = body;
    const apiKey = process.env.NIB_API_KEY;

    if (!receivedSignature || !apiKey) {
        console.error('Callback Error: Signature or API Key is missing.');
        return NextResponse.json({ success: false, message: 'Invalid callback payload or configuration.' }, { status: 400 });
    }

    // Add the API Key to the payload for signature generation, as NIBtera does
    const payloadWithKey = { ...payloadToVerify, Key: apiKey };

    const generatedSignature = createSignature(payloadWithKey);

    if (generatedSignature !== receivedSignature) {
        console.error('Callback Error: Signature mismatch.');
        console.log('Received Signature:', receivedSignature);
        console.log('Generated Signature:', generatedSignature);
        return NextResponse.json({ success: false, message: 'Signature verification failed.' }, { status: 400 });
    }

    console.log('✅ Callback Authenticated and Verified Successfully.');

    // In a real application, you would add logic here to:
    // 1. Find the transaction in your database using `body.transactionId`.
    // 2. Update the transaction status based on `body.status` or similar field.
    // 3. If the payment was successful, create the corresponding 'Saving' record for the member.
    // 4. Ensure you don't process the same `transactionId` twice.

    // Respond to NIBtera to acknowledge receipt of the callback.
    return NextResponse.json({ success: true, message: "Callback received and verified." }, { status: 200 });

  } catch (error) {
    console.error('Error processing NIBtera callback:', error);
    return NextResponse.json({ success: false, message: 'Error processing callback.' }, { status: 500 });
  }
}
