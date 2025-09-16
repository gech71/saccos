
import { getPublishedPosts } from '@/lib/website-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default async function NewsPage() {
  const posts = await getPublishedPosts();

  return (
    <div className="bg-background py-12 md:py-20">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl text-center mb-12">
          News & Updates
        </h1>

        {posts.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Card key={post.id} className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="p-0">
                  {post.imageUrl && (
                    <div className="relative h-48 w-full">
                      <Image
                        src={post.imageUrl}
                        alt={post.title}
                        layout="fill"
                        objectFit="cover"
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-6 flex-1">
                  <CardTitle className="text-xl font-bold mb-2 line-clamp-2">
                    <Link href={`/news/${post.id}`} className="hover:text-primary transition-colors">
                      {post.title}
                    </Link>
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground mb-4">
                    {format(new Date(post.createdAt), 'PPP')}
                  </CardDescription>
                  <div
                    className="text-muted-foreground line-clamp-3"
                    dangerouslySetInnerHTML={{ __html: post.content.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...' }}
                  />
                </CardContent>
                <CardFooter>
                  <Button asChild variant="link" className="p-0 h-auto">
                    <Link href={`/news/${post.id}`}>
                      Read More <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">No news updates at the moment. Please check back later.</p>
          </div>
        )}
      </div>
    </div>
  );
}
