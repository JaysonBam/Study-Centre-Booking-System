import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Hamburger from "@/components/ui/hamburger";

interface Room {
  id: number;
  name: string;
  dynamic_labels: string[] | null;
}

const MAINTENANCE_ISSUES = [
  { label: "Lights", emoji: "💡" },
  { label: "Plugs", emoji: "🔌" },
  { label: "Screen", emoji: "🖥️" },
];

const RoomMaintenance = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name, dynamic_labels")
        .order("name");

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  const toggleIssue = async (roomId: number, issueLabel: string, issueEmoji: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    const fullLabel = `${issueLabel} ${issueEmoji}`;
    const currentLabels = room.dynamic_labels || [];
    const hasIssue = currentLabels.includes(fullLabel);

    let newLabels: string[];
    if (hasIssue) {
      newLabels = currentLabels.filter((l) => l !== fullLabel);
    } else {
      newLabels = [...currentLabels, fullLabel];
    }

    // Optimistic update
    setRooms(rooms.map((r) => (r.id === roomId ? { ...r, dynamic_labels: newLabels } : r)));

    try {
      const { error } = await supabase
        .from("rooms")
        .update({ dynamic_labels: newLabels })
        .eq("id", roomId);

      if (error) throw error;
      // toast.success("Room updated");
    } catch (error) {
      console.error("Error updating room:", error);
      toast.error("Failed to update room");
      // Revert on error
      setRooms(rooms.map((r) => (r.id === roomId ? { ...r, dynamic_labels: currentLabels } : r)));
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-40 bg-white border-b px-4 py-2 flex items-center gap-4 shadow-sm">
        <Hamburger />
        <h1 className="text-lg font-semibold">Room Maintenance</h1>
      </div>
      <div className="container mx-auto p-4 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <Card key={room.id}>
              <CardHeader>
                <CardTitle>{room.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {MAINTENANCE_ISSUES.map((issue) => {
                    const fullLabel = `${issue.label} ${issue.emoji}`;
                    const isChecked = room.dynamic_labels?.includes(fullLabel) || false;
                    
                    return (
                      <div key={issue.label} className="flex items-center space-x-2">
                        <Checkbox
                          id={`room-${room.id}-${issue.label}`}
                          checked={isChecked}
                          onCheckedChange={() => toggleIssue(room.id, issue.label, issue.emoji)}
                        />
                        <Label
                          htmlFor={`room-${room.id}-${issue.label}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none flex items-center gap-2"
                        >
                          <span>{issue.emoji}</span>
                          <span>{issue.label}</span>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoomMaintenance;
