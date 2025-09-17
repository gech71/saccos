
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash2, Loader2, MoreVertical } from 'lucide-react';
import { getPostsForAdmin, createPost, updatePost, deletePost } from '../website/actions';
import type { Post } from '@prisma/client';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/file-upload';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const initialFormState: Partial<Post> = {
  title: '',
  content: '',
  imageUrl: '',
  isPublished: false,
};

export default function ManageNewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPost, setCurrentPost] = useState<Partial<Post>>(initialFormState);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const data = await getPostsForAdmin();
      setPosts(data);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load news posts.' });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentPost(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setCurrentPost(prev => ({ ...prev, isPublished: checked }));
  };

  const handleImageUpload = (url: string) => {
    setCurrentPost(prev => ({ ...prev, imageUrl: url }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPost.title || !currentPost.content) {
      toast({ variant: 'destructive', title: 'Error', description: 'Title and content are required.' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && currentPost.id) {
        await updatePost(currentPost.id, {
          title: currentPost.title,
          content: currentPost.content,
          imageUrl: currentPost.imageUrl,
          isPublished: currentPost.isPublished,
        });
        toast({ title: 'Success', description: 'Post updated successfully.' });
      } else {
        await createPost({
          title: currentPost.title,
          content: currentPost.content,
          imageUrl: currentPost.imageUrl,
          isPublished: currentPost.isPublished || false,
        });
        toast({ title: 'Success', description: 'Post created successfully.' });
      }
      await fetchPosts();
      setIsModalOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save post.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setCurrentPost(initialFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (post: Post) => {
    setCurrentPost(post);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openDeleteDialog = (postId: string) => {
    setPostToDelete(postId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!postToDelete) return;
    setIsSubmitting(true);
    try {
      await deletePost(postToDelete);
      toast({ title: 'Success', description: 'Post deleted successfully.' });
      await fetchPosts();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete post.' });
    }
    setPostToDelete(null);
    setIsDeleteDialogOpen(false);
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Manage News" subtitle="Create, edit, and publish news posts for your public website.">
        <Button onClick={openAddModal}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Post
        </Button>
      </PageTitle>

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin" /></TableCell></TableRow>
            ) : posts.length > 0 ? (
              posts.map(post => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell>
                    <Badge variant={post.isPublished ? 'default' : 'secondary'}>
                      {post.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(post.createdAt), 'PPP')}</TableCell>
                  <TableCell className="text-right">
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditModal(post)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDeleteDialog(post.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={4} className="h-24 text-center">No news posts found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Post' : 'Create New Post'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" value={currentPost.title || ''} onChange={handleInputChange} required />
            </div>
            <div>
              <Label htmlFor="content">Content (HTML supported)</Label>
              <Textarea id="content" name="content" value={currentPost.content || ''} onChange={handleInputChange} rows={10} required />
            </div>
            <div>
               <Label htmlFor="imageUrl">Featured Image</Label>
               <FileUpload
                    id="imageUrl"
                    label="Upload a featured image for the post"
                    value={currentPost.imageUrl || ''}
                    onValueChange={handleImageUpload}
                />
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="isPublished" checked={currentPost.isPublished || false} onCheckedChange={handleSwitchChange} />
              <Label htmlFor="isPublished">Publish this post</Label>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Create Post'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this news post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
