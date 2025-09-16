
import { getPostById } from '@/lib/website-actions';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';

export default async function PostPage({ params }: { params: { postId: string } }) {
  const post = await getPostById(params.postId);

  if (!post) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <article className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl mb-4">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <time dateTime={post.createdAt.toISOString()}>
                {format(new Date(post.createdAt), 'PPP')}
              </time>
            </div>
             {post.isPublished ? (
                <Badge variant="default">Published</Badge>
              ) : (
                <Badge variant="secondary">Draft</Badge>
              )}
          </div>
        </header>

        {post.imageUrl && (
          <div className="relative h-96 w-full overflow-hidden rounded-xl shadow-lg mb-8">
            <Image
              src={post.imageUrl}
              alt={post.title}
              layout="fill"
              objectFit="cover"
            />
          </div>
        )}

        <div
          className="prose max-w-none text-lg"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>
    </div>
  );
}
