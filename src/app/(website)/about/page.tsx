
import { getWebsiteContent } from '@/lib/website-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

export default async function AboutPage() {
  const content = await getWebsiteContent();

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
              About {content?.saccoName || 'AcademInvest'}
            </h1>
            <div className="prose max-w-none text-muted-foreground text-lg whitespace-pre-line">
              {content?.aboutUs || (
                <>
                  <p>
                    We are a member-owned financial cooperative dedicated to providing quality financial services to the educational community. Our mission is to promote thrift, provide access to credit, and support the financial well-being of our members.
                  </p>
                  <p>
                    Founded on the principles of cooperation and mutual support, we strive to be a trusted partner for all our members, helping them achieve their financial goals through ethical and transparent practices.
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="relative h-80 w-full overflow-hidden rounded-xl shadow-lg">
             <Image
                src={content?.aboutUsImageUrl || "https://picsum.photos/seed/community/800/600"}
                alt="Community"
                layout="fill"
                objectFit="cover"
                data-ai-hint="community people smiling"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
