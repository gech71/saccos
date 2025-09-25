'use client';

import { useState } from 'react';
import { getWebsiteContent } from '@/lib/website-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, MapPin, Phone } from 'lucide-react';

export default function ContactPageWrapper() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const data = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      message: formData.get('message'),
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        setStatus('✅ Message sent successfully!');
        console.log("✅ Message sent successfully!");        
        form.reset(); // ✅ safe since we hold ref to form

        // Auto-clear success message after 5s
        setTimeout(() => setStatus(null), 5000);

      } else {
        setStatus(`❌ ${result.error || 'Failed to send message'}`);
      }
    } catch (err) {
      setStatus('❌ Something went wrong, please try again later.');
    } finally {
      setLoading(false);
    }
  }

  return <ContactPage onSubmit={handleSubmit} status={status} loading={loading} />;
}

// Keep your existing layout & styling
function ContactPage({
  onSubmit,
  status,
  loading,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  status: string | null;
  loading: boolean;
}) {
  return (
    <div className="bg-background py-12 md:py-20">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl text-center mb-12">
          Get In Touch
        </h1>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Information */}
          <div className="space-y-8">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-lg">
                <div className="flex items-start gap-4">
                  <MapPin className="h-6 w-6 text-primary mt-1" />
                  <p className="text-muted-foreground">
                    123 Main Street, Addis Ababa, Ethiopia
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Mail className="h-6 w-6 text-primary" />
                  <a
                    href="mailto:contact@academinvest.com"
                    className="text-muted-foreground hover:text-primary"
                  >
                    contact@academinvest.com
                  </a>
                </div>
                <div className="flex items-center gap-4">
                  <Phone className="h-6 w-6 text-primary" />
                  <a
                    href="tel:+251-911-123-456"
                    className="text-muted-foreground hover:text-primary"
                  >
                    +251-911-123-456
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="space-y-8">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Send Us a Message</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={onSubmit}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" name="firstName" placeholder="John" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" name="lastName" placeholder="Doe" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="john.doe@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" name="message" placeholder="Your message..." />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Sending...' : 'Send Message'}
                  </Button>
                  {status && (
                    <p className="text-sm text-center mt-2 text-muted-foreground">
                      {status}
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
