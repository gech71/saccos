
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getWebsiteContent } from '@/lib/website-actions';
import { ArrowRight, Landmark, PiggyBank, HandCoins } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default async function HomePage() {
  const content = await getWebsiteContent();

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full h-[60vh] flex items-center justify-center text-center text-white bg-accent/80">
           <Image
            src="https://picsum.photos/seed/rocket/1200/800"
            alt="Community finance"
            layout="fill"
            objectFit="cover"
            className="absolute inset-0 z-[-1] object-cover w-full h-full"
            data-ai-hint="community finance people collaborating"
          />
          <div className="absolute inset-0 bg-black/50 z-[-1]"></div>
          <div className="container px-4 md:px-6 z-10">
            <div className="max-w-3xl mx-auto space-y-4">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
                {content?.heroTitle || 'Empowering Your Financial Future, Together.'}
              </h1>
              <p className="text-lg md:text-xl text-gray-200">
                {content?.heroSubtitle || 'Your trusted partner in savings and credit for the educational community.'}
              </p>
              <div className="flex flex-col gap-2 min-[400px]:flex-row justify-center">
                <Button asChild size="lg">
                  <Link href="/about">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Our Services</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-primary">What We Offer</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  We provide a range of financial products tailored to meet the needs of our members.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-6 py-12 lg:grid-cols-3 lg:gap-12">
              {content?.services && content.services.length > 0 ? (
                content.services.map(service => {
                  return (
                    <Card key={service.id}>
                      <CardHeader className="flex flex-col items-center text-center">
                          {service.icon ? (
                            <Image src={service.icon} alt={service.title} width={40} height={40} className="h-10 w-10 mb-2 rounded-sm object-contain" />
                          ): (
                            <div className="p-4 bg-primary/10 rounded-full mb-2"><HandCoins className="h-8 w-8 text-primary"/></div>
                          )}
                          <CardTitle>{service.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                          <p className="text-center text-muted-foreground">{service.description}</p>
                      </CardContent>
                    </Card>
                  )
                })
              ) : (
                <>
                  <Card>
                    <CardHeader className="flex flex-col items-center text-center">
                        <div className="p-4 bg-primary/10 rounded-full mb-2"><PiggyBank className="h-8 w-8 text-primary"/></div>
                        <CardTitle>Savings Accounts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-muted-foreground">Secure and grow your funds with our competitive savings products designed for stability and growth.</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-col items-center text-center">
                        <div className="p-4 bg-primary/10 rounded-full mb-2"><Landmark className="h-8 w-8 text-primary"/></div>
                        <CardTitle>Affordable Loans</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-muted-foreground">Access capital for your personal and professional needs with our fair and transparent loan products.</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-col items-center text-center">
                        <div className="p-4 bg-primary/10 rounded-full mb-2"><HandCoins className="h-8 w-8 text-primary"/></div>
                        <CardTitle>Dividends & Shares</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-muted-foreground">Invest in the SACCO and earn returns on your shares through our annual dividend distributions.</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </section>

        {/* About Us Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted">
            <div className="container grid items-center gap-6 px-4 md:px-6 lg:grid-cols-2 lg:gap-10">
                <div className="space-y-4 px-4 sm:px-6 md:px-8 lg:pl-12">
                    <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight text-primary">
                        About {content?.saccoName || 'AcademInvest'}
                    </h2>
                    <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                        {(content?.aboutUs || 'We are a member-owned financial cooperative dedicated to providing quality financial services to the educational community. Our mission is to promote thrift, provide access to credit, and support the financial well-being of our members.').substring(0, 250) + '...'}
                    </p>
                     <Button asChild>
                      <Link href="/about">
                        Read Our Full Story <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                </div>
                <Image
                    src="https://picsum.photos/seed/team/600/400"
                    alt="Our Team"
                    width={600}
                    height={400}
                    className="mx-auto aspect-video overflow-hidden rounded-xl object-cover object-center sm:w-full"
                    data-ai-hint="team collaboration"
                />
            </div>
        </section>
      </main>
    </div>
  );
}
