"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	DndContext,
	type DragEndEvent,
	useDraggable,
	useDroppable,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	loadTodos,
	createTodo,
	toggleTodo,
	updateTodo,
	deleteTodo,
} from "./actions";

const formSchema = z.object({
	title: z.string().min(1, "Title is required"),
});

type TodoItem = {
	id: string;
	title: string;
	done: boolean;
	created_at: string;
};

const TODO_COLUMN = "todo";
const DONE_COLUMN = "done";

function TodoCard({
	item,
	editingId,
	editTitle,
	onEdit,
	onUpdate,
	onCancelEdit,
	onDelete,
}: {
	item: TodoItem;
	editingId: string | null;
	editTitle: string;
	onEdit: (id: string, title: string) => void;
	onUpdate: (id: string) => void;
	onCancelEdit: () => void;
	onDelete: (id: string) => void;
}) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: item.id,
		data: { item },
	});

	return (
		<Card
			ref={setNodeRef}
			className={`group ${isDragging ? "opacity-50 shadow-lg" : ""} ${item.done ? "opacity-90" : ""}`}
		>
			<CardContent className="flex items-center gap-2 py-3 px-3">
				<button
					type="button"
					className="cursor-grab active:cursor-grabbing touch-none p-0.5 rounded hover:bg-muted text-muted-foreground"
					{...listeners}
					{...attributes}
					onClick={(e) => e.stopPropagation()}
				>
					<GripVertical className="h-4 w-4" />
				</button>
				{editingId === item.id ? (
					<div className="flex flex-1 gap-2 min-w-0">
						<Input
							value={editTitle}
							onChange={(e) => onEdit(item.id, e.target.value)}
							className="flex-1 h-8"
							autoFocus
							onKeyDown={(e) => {
								if (e.key === "Enter") onUpdate(item.id);
								if (e.key === "Escape") onCancelEdit();
							}}
						/>
						<Button size="sm" variant="ghost" onClick={() => onUpdate(item.id)}>
							Save
						</Button>
						<Button size="sm" variant="ghost" onClick={onCancelEdit}>
							Cancel
						</Button>
					</div>
				) : (
					<>
						<span
							className={`flex-1 font-medium truncate ${item.done ? "line-through text-muted-foreground" : ""}`}
						>
							{item.title}
						</span>
						<div className="flex gap-1 opacity-0 group-hover:opacity-100">
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								onClick={() => onEdit(item.id, item.title)}
							>
								<Pencil className="h-3.5 w-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-destructive"
								onClick={() => onDelete(item.id)}
							>
								<Trash2 className="h-3.5 w-3.5" />
							</Button>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

function DroppableColumn({
	id,
	title,
	children,
	count,
}: {
	id: string;
	title: string;
	children: React.ReactNode;
	count: number;
}) {
	const { setNodeRef, isOver } = useDroppable({ id });

	return (
		<div
			ref={setNodeRef}
			className={`flex-1 min-w-0 rounded-lg border-2 border-dashed p-4 transition-colors ${
				isOver ? "border-primary bg-primary/5" : "border-muted bg-muted/30"
			}`}
		>
			<div className="flex items-center gap-2 mb-4">
				<div className="h-3 w-3 rounded-full bg-primary" />
				<span className="font-semibold">{title}</span>
				<span className="text-sm text-muted-foreground">({count})</span>
			</div>
			<div className="space-y-2 min-h-[120px]">{children}</div>
		</div>
	);
}

export default function TodoPage() {
	const [todos, setTodos] = useState<TodoItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [open, setOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState("");
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteTodoId, setDeleteTodoId] = useState<string | null>(null);
	const [deleteTodoLoading, setDeleteTodoLoading] = useState(false);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		}),
	);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: { title: "" },
	});

	useEffect(() => {
		async function load() {
			try {
				const { data } = await loadTodos();
				setTodos((data as TodoItem[]) ?? []);
			} finally {
				setLoading(false);
			}
		}
		load();
	}, []);

	async function onSubmit(values: z.infer<typeof formSchema>) {
		setSubmitting(true);
		const { error, data } = await createTodo(values.title);
		setSubmitting(false);
		if (error) {
			toast.error(error);
			return;
		}
		if (data) {
			setTodos((prev) => [data as TodoItem, ...prev]);
		}
		toast.success("Task created");
		setOpen(false);
		form.reset({ title: "" });
		form.clearErrors();
	}

	async function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over) return;

		const item = todos.find((t) => t.id === active.id);
		if (!item) return;

		let newDone: boolean;
		const overId = String(over.id);
		if (overId === DONE_COLUMN) {
			newDone = true;
		} else if (overId === TODO_COLUMN) {
			newDone = false;
		} else {
			const overItem = todos.find((t) => t.id === overId);
			if (!overItem) return;
			newDone = overItem.done;
		}
		if (item.done === newDone) return;

		const { error } = await toggleTodo(item.id, !item.done);
		if (error) {
			toast.error(error);
			return;
		}
		setTodos((prev) =>
			prev.map((t) => (t.id === item.id ? { ...t, done: newDone } : t)),
		);
		toast.success(newDone ? "Task completed" : "Task moved to To Do");
	}

	async function handleUpdate(id: string) {
		if (!editTitle.trim()) return;
		const { error } = await updateTodo(id, editTitle);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success("Task updated");
		setEditingId(null);
		setEditTitle("");
		setTodos((prev) =>
			prev.map((t) => (t.id === id ? { ...t, title: editTitle } : t)),
		);
	}

	function openDeleteDialog(id: string) {
		setDeleteTodoId(id);
		setDeleteDialogOpen(true);
	}

	async function handleDeleteConfirm() {
		if (!deleteTodoId) return;
		const id = deleteTodoId;
		setDeleteTodoLoading(true);
		const { error } = await deleteTodo(id);
		setDeleteTodoLoading(false);
		setDeleteDialogOpen(false);
		setDeleteTodoId(null);
		if (error) {
			toast.error(error);
			return;
		}
		toast.success("Task deleted");
		setTodos((prev) => prev.filter((t) => t.id !== id));
	}

	const toDoItems = todos.filter((t) => !t.done);
	const doneItems = todos.filter((t) => t.done);

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl font-bold tracking-tight">To-Do</h1>
					<p className="text-lg text-muted-foreground">
						Drag tasks to Finished when done
					</p>
				</div>
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button onClick={() => { form.reset({ title: "" }); form.clearErrors(); }}>
							<Plus className="mr-2 h-4 w-4" />
							New Task
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>New Task</DialogTitle>
							<DialogDescription>
								Add a task to your to-do list
							</DialogDescription>
						</DialogHeader>
						<Form {...form}>
							<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
								<FormField
									control={form.control}
									name="title"
									render={({ field }) => (
										<FormItem className="space-y-0">
											<FormControl>
												<Input placeholder="What needs to be done?" {...field} className="h-10" />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<DialogFooter>
									<Button
										type="button"
										variant="outline"
										onClick={() => setOpen(false)}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={submitting}>
										{submitting ? "Creating..." : "Create"}
									</Button>
								</DialogFooter>
							</form>
						</Form>
					</DialogContent>
				</Dialog>
			</div>

			{loading ? (
				<p className="text-muted-foreground">Loading...</p>
			) : (
				<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
					<div className="flex gap-6 w-full">
						<DroppableColumn
							id={TODO_COLUMN}
							title="To Do"
							count={toDoItems.length}
						>
							{toDoItems.length === 0 ? (
								<p className="text-sm text-muted-foreground py-8 text-center">
									No tasks. Create one!
								</p>
							) : (
								toDoItems.map((t) => (
									<TodoCard
										key={t.id}
										item={t}
										editingId={editingId}
										editTitle={editTitle}
										onEdit={(id, title) => {
											setEditingId(id);
											setEditTitle(title);
										}}
										onUpdate={handleUpdate}
										onCancelEdit={() => {
											setEditingId(null);
											setEditTitle("");
										}}
										onDelete={openDeleteDialog}
									/>
								))
							)}
						</DroppableColumn>

						<DroppableColumn
							id={DONE_COLUMN}
							title="Finished"
							count={doneItems.length}
						>
							{doneItems.length === 0 ? (
								<p className="text-sm text-muted-foreground py-8 text-center">
									Drop tasks here when done
								</p>
							) : (
								doneItems.map((t) => (
									<TodoCard
										key={t.id}
										item={t}
										editingId={editingId}
										editTitle={editTitle}
										onEdit={(id, title) => {
											setEditingId(id);
											setEditTitle(title);
										}}
										onUpdate={handleUpdate}
										onCancelEdit={() => {
											setEditingId(null);
											setEditTitle("");
										}}
										onDelete={openDeleteDialog}
									/>
								))
							)}
						</DroppableColumn>
					</div>
				</DndContext>
			)}

			<Dialog open={deleteDialogOpen} onOpenChange={(o) => { setDeleteDialogOpen(o); if (!o) setDeleteTodoId(null); }}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete task?</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this task? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteTodoLoading}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteTodoLoading}>
							{deleteTodoLoading ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
