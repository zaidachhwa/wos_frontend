import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// Generic column-per-status board with drag-and-drop, driven by a
// [status, label] list and a card renderer — used by the Projects and
// Modules kanban pages.
export default function StatusBoard({ statuses, items, renderCard, onDragEnd }) {
  const byStatus = (status) => items.filter((item) => item.status === status);
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {statuses.map(([status, label]) => {
          const colItems = byStatus(status);
          return (
            <Droppable droppableId={status} key={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex w-72 shrink-0 flex-col rounded-card border border-border p-3 transition-colors duration-150 ${
                    snapshot.isDraggingOver ? "border-info/40 bg-info/5" : "bg-background/60"
                  }`}
                >
                  <p className="flex items-center justify-between px-1 pb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    {label}
                    <span className="rounded-full bg-border/60 px-2 py-0.5 tabular-nums">{colItems.length}</span>
                  </p>
                  <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                    {colItems.map((item, index) => (
                      <Draggable
                        draggableId={item._id}
                        index={index}
                        key={item._id}
                        disableInteractiveElementBlocking
                      >
                        {(drag, dragSnapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            className={dragSnapshot.isDragging ? "rounded-card shadow-md ring-2 ring-info/30" : ""}
                          >
                            {renderCard(item)}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}
