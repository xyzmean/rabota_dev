import React, { useState } from 'react';
import { GripVertical } from 'lucide-react';

interface DraggableListProps<T> {
  items: T[];
  getId: (item: T) => number;
  renderItem: (item: T) => React.ReactNode;
  onReorder: (newItems: T[]) => void;
  className?: string;
}

export default function DraggableList<T>({
  items,
  getId,
  renderItem,
  onReorder,
  className = '',
}: DraggableListProps<T>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    onReorder(newItems);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className={className}>
      {items.map((item, index) => (
        <div
          key={getId(item)}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-2 p-3 mb-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg cursor-move hover:shadow-md transition-shadow ${
            draggedIndex === index ? 'opacity-50' : ''
          }`}
        >
          <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <div className="flex-1">{renderItem(item)}</div>
        </div>
      ))}
    </div>
  );
}
