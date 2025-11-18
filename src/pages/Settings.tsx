import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { buttonVariants } from "@/components/ui/button";
import Hamburger from "@/components/ui/hamburger";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type RoomRow = {
  id: number;
  name: string;
  capacity: number | null;
  borrowable_items?: string[] | null;
  dynamic_labels?: string[] | null;
  is_available?: boolean | null;
  is_open?: boolean | null;
};

type CourseRow = {
  id: number;
  name: string;
  color_hex?: string | null;
};

// mods removed - no longer stored here

const Settings: React.FC = () => {
  
  const { toast } = useToast();

  const [savingAll, setSavingAll] = useState(false);

  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [deletedRoomIds, setDeletedRoomIds] = useState<number[]>([]);
  const [deletedCourseIds, setDeletedCourseIds] = useState<number[]>([]);

  // Raw input map for array-like fields so we can preserve trailing commas/spaces
  // while the user is typing. Committed to `rooms` on blur or when saving all.
  const [borrowableInputs, setBorrowableInputs] = useState<Record<number, string>>({});

  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // operation hours stored under settings key 'operation_hours'
  const [opStart, setOpStart] = useState("08:00");
  const [opEnd, setOpEnd] = useState("17:00");

  // testing clock stored under settings key 'testing_clock'
  const [testingEnabled, setTestingEnabled] = useState(false);
  const [testingDate, setTestingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [testingTime, setTestingTime] = useState(() => new Date().toTimeString().slice(0, 5));

  // no dialog editor; edits are inline and persisted via the master "Save all" button

  useEffect(() => {
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    await Promise.all([fetchRooms(), fetchCourses(), fetchSettings()]);
  }

  async function fetchRooms() {
    setLoadingRooms(true);
    const { data, error } = await supabase.from("rooms").select("*");
    setLoadingRooms(false);
    if (error) {
      toast({ title: "Failed to load rooms", description: error.message });
      return;
    }
    const rows = ((data ?? []) as RoomRow[]).sort((a, b) => a.name.localeCompare(b.name));
    setRooms(rows);

    // initialize raw input map so typing preserves trailing separators
    const borrowMap: Record<number, string> = {};
    rows.forEach((r) => {
      borrowMap[r.id] = (r.borrowable_items ?? []).join(", ");
    });
    setBorrowableInputs(borrowMap);
  }

  async function fetchCourses() {
    setLoadingCourses(true);
    const { data, error } = await supabase.from("courses").select("*");
    setLoadingCourses(false);
    if (error) {
      toast({ title: "Failed to load courses", description: error.message });
      return;
    }
    setCourses(((data ?? []) as CourseRow[]).sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function fetchSettings() {
    // operation hours
    const { data: hoursData, error: hoursErr } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "operation_hours")
      .single();
    if (hoursErr && hoursErr.code !== "PGRST116") {
      // PGRST116 means no rows found for single - ignore
      console.warn(hoursErr);
    }
    if (hoursData?.value) {
      const v = hoursData.value as any;
      if (v.start) setOpStart(v.start);
      if (v.end) setOpEnd(v.end);
    }

    // testing clock
    const { data: testData, error: testErr } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "testing_clock")
      .single();
    if (testErr && testErr.code !== "PGRST116") {
      console.warn(testErr);
    }
    if (testData?.value) {
      const v = testData.value as any;
      if (typeof v.enabled === "boolean") setTestingEnabled(!!v.enabled);
      if (v.date) setTestingDate(v.date);
      if (v.time) setTestingTime(v.time);
    }
  }

  // operation hours will be saved as part of the master Save All flow

  // Per-row save removed — use the master "Save all" button to persist changes.

  // Per-row save removed for courses — use master save pattern if desired in future.

  // Create course locally; actual insert happens on Save All
  async function createCourse(name: string, color_hex?: string) {
    const tempId = -Date.now() - Math.floor(Math.random() * 1000);
    setCourses((s) => [...s, { id: tempId, name, color_hex: color_hex ?? null }]);
  }

  // Delete course locally; actual delete happens on Save All
  async function deleteCourse(id: number) {
    setCourses((s) => s.filter((c) => c.id !== id));
    if (id > 0) setDeletedCourseIds((s) => [...s, id]);
  }

  // Delete room locally; actual delete happens on Save All
  async function deleteRoom(id: number) {
    setRooms((s) => s.filter((r) => r.id !== id));
    setBorrowableInputs((s) => {
      const copy = { ...s };
      delete copy[id];
      return copy;
    });
    if (id > 0) setDeletedRoomIds((s) => [...s, id]);
  }

  // Toggle single boolean field on a room and persist immediately (optimistic)
  // Toggle single boolean field on a room locally; persist on Save All
  function handleToggleRoomField(id: number, field: "is_available" | "is_open", value: boolean) {
    setRooms((s) => s.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  // create room directly from quick-add (accepts full payload)
  async function createRoom(payload: {
    name: string;
    capacity?: number | null;
    borrowable_items?: string[] | null;
    dynamic_labels?: string[] | null;
    is_available?: boolean | null;
    is_open?: boolean | null;
  }) {
    // create locally with temporary negative id; actual insert happens on Save All
    const tempId = -Date.now() - Math.floor(Math.random() * 1000);
    const newRoom: RoomRow = {
      id: tempId,
      name: payload.name,
      capacity: payload.capacity ?? null,
      borrowable_items: payload.borrowable_items ?? null,
      dynamic_labels: payload.dynamic_labels ?? null,
      is_available: payload.is_available ?? null,
      is_open: payload.is_open ?? null,
    };
    setRooms((s) => [...s, newRoom]);
    setBorrowableInputs((s) => ({ ...s, [newRoom.id]: (newRoom.borrowable_items ?? []).join(", ") }));
  }

  // Save all rooms (bulk update). This will run updates for every room currently in state.
  async function saveAllRooms() {
    setSavingAll(true);
    try {
      // First, process deletions
      if (deletedRoomIds.length) {
        const { error } = await supabase.from("rooms").delete().in("id", deletedRoomIds);
        if (error) {
          toast({ title: "Failed to delete some rooms", description: error.message });
        }
      }
      if (deletedCourseIds.length) {
        const { error } = await supabase.from("courses").delete().in("id", deletedCourseIds);
        if (error) {
          toast({ title: "Failed to delete some courses", description: error.message });
        }
      }

      // Separate new vs existing rooms
      const newRooms = rooms.filter((r) => r.id < 0);
      const existingRooms = rooms.filter((r) => r.id > 0);

      // Update existing rooms
      const updateRoomResults = await Promise.all(
        existingRooms.map(async (row) => {
          const rawBorrow = borrowableInputs[row.id];
          const parsedBorrow =
            rawBorrow !== undefined
              ? rawBorrow.split(",").map((s) => s.trim()).filter(Boolean)
              : row.borrowable_items ?? null;
          const payload: any = {
            name: row.name,
            capacity: row.capacity ?? null,
            borrowable_items: Array.isArray(parsedBorrow) ? (parsedBorrow.length ? parsedBorrow : null) : null,
            dynamic_labels: row.dynamic_labels ?? null,
            is_available: row.is_available ?? null,
            is_open: row.is_open ?? null,
          };
          const { error } = await supabase.from("rooms").update(payload).eq("id", row.id);
          return error;
        }),
      );

      // Insert new rooms in a single batch
      let insertRoomError = null;
      if (newRooms.length) {
        const insertPayloads = newRooms.map((row) => {
          const rawBorrow = borrowableInputs[row.id];
          const parsedBorrow =
            rawBorrow !== undefined
              ? rawBorrow.split(",").map((s) => s.trim()).filter(Boolean)
              : row.borrowable_items ?? null;
          return {
            name: row.name,
            capacity: row.capacity ?? null,
            borrowable_items: Array.isArray(parsedBorrow) ? (parsedBorrow.length ? parsedBorrow : null) : null,
            dynamic_labels: row.dynamic_labels ?? null,
            is_available: row.is_available ?? null,
            is_open: row.is_open ?? null,
          };
        });
        const { error } = await supabase.from("rooms").insert(insertPayloads);
        insertRoomError = error;
      }

      const roomErrors = [...updateRoomResults.filter(Boolean), ...(insertRoomError ? [insertRoomError] : [])];
      if (roomErrors.length) {
        toast({ title: "Some rooms failed to save" });
      }

      // Courses: update existing and insert new
      const newCourses = courses.filter((c) => c.id < 0);
      const existingCourses = courses.filter((c) => c.id > 0);

      const updateCourseResults = await Promise.all(
        existingCourses.map(async (course) => {
          const { error } = await supabase.from("courses").update({ name: course.name, color_hex: course.color_hex ?? null }).eq("id", course.id);
          return error;
        }),
      );

      let insertCourseError = null;
      if (newCourses.length) {
        const insertPayloads = newCourses.map((c) => ({ name: c.name, color_hex: c.color_hex ?? null }));
        const { error } = await supabase.from("courses").insert(insertPayloads);
        insertCourseError = error;
      }

      const courseErrors = [...updateCourseResults.filter(Boolean), ...(insertCourseError ? [insertCourseError] : [])];
      if (courseErrors.length) {
        toast({ title: "Some courses failed to save" });
      }

      // now save operation hours as part of the master save
      const hoursPayload = { start: opStart, end: opEnd };
      const { error: hoursErr } = await supabase.from("settings").upsert({ key: "operation_hours", value: hoursPayload });
      if (hoursErr) {
        toast({ title: "Settings saved but failed to save operation hours", description: hoursErr.message });
      } else {
        toast({ title: "All settings saved" });
      }

      // save testing clock
      const testingPayload = { enabled: testingEnabled, date: testingDate, time: testingTime };
      const { error: testingErr } = await supabase.from("settings").upsert({ key: "testing_clock", value: testingPayload });
      if (testingErr) {
        toast({ title: "Settings saved but failed to save testing clock", description: testingErr.message });
      }

      // refresh local state from backend and clear deleted trackers
      await Promise.all([fetchRooms(), fetchCourses()]);
      setDeletedRoomIds([]);
      setDeletedCourseIds([]);
    } finally {
      setSavingAll(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Hamburger />
          </div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <div>
            <button
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "px-2 py-1 bg-blue-600 text-white")}
              onClick={saveAllRooms}
              disabled={savingAll}
            >
              {savingAll ? "Saving..." : "Save all"}
            </button>
          </div>
        </div>

        <section className="mb-8 bg-card p-4 rounded-md">
          <h2 className="text-lg font-medium mb-2">Operation hours</h2>
          <div className="flex gap-3 items-center">
            <div className="w-40">
              <label className="block text-sm mb-1">Start</label>
              <Input type="time" value={opStart} onChange={(e) => setOpStart(e.target.value)} />
            </div>
            <div className="w-40">
              <label className="block text-sm mb-1">End</label>
              <Input type="time" value={opEnd} onChange={(e) => setOpEnd(e.target.value)} />
            </div>
            <div>
            </div>
          </div>
        </section>

        <section className="mb-8 bg-card p-4 rounded-md">
          <h2 className="text-lg font-medium mb-2">Clock mode</h2>
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={testingEnabled} onChange={(e) => setTestingEnabled(e.target.checked)} />
              <span className="text-sm">Use testing time</span>
            </label>

            <div className="w-40">
              <label className="block text-sm mb-1">Date</label>
              <Input type="date" value={testingDate} onChange={(e) => setTestingDate(e.target.value)} disabled={!testingEnabled} />
            </div>
            <div className="w-40">
              <label className="block text-sm mb-1">Time</label>
              <Input type="time" value={testingTime} onChange={(e) => setTestingTime(e.target.value)} disabled={!testingEnabled} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">When testing time is enabled the app will return this date/time instead of the system clock (useful for testing scheduling features).</p>
        </section>

        <section className="mb-8 bg-card p-2 rounded-md">
          <h2 className="text-sm font-medium mb-0 leading-tight">Rooms</h2>
          {/* Add room moved to bottom of list */}
          {loadingRooms ? (
            <div className="text-sm">Loading rooms...</div>
          ) : (
            <div className="space-y-2">
              {/* Column headings */}
              <div className="grid grid-cols-12 gap-2 items-center font-medium text-xs text-muted-foreground border-b pb-1">
                <div className="col-span-2">Name</div>
                <div className="col-span-1">Cap</div>
                  <div className="col-span-4">Borrowable items</div>
                <div className="col-span-1">Available</div>
                <div className="col-span-1">Open</div>
                  <div className="col-span-3">&nbsp;</div>
              </div>
              {rooms.map((r) => (
                <div key={r.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2">
                    <Input className="h-7 text-xs max-w-[10rem]" value={r.name} onChange={(e) => setRooms((s) => s.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))} />
                  </div>
                  <div className="col-span-1">
                    <Input className="h-7 text-xs w-16" type="number" value={r.capacity ?? ""} onChange={(e) => setRooms((s) => s.map((x) => (x.id === r.id ? { ...x, capacity: e.target.value ? Number(e.target.value) : null } : x)))} />
                  </div>
                  <div className="col-span-4">
                    <Input
                      className="h-7 text-xs"
                      placeholder="e.g. projector, whiteboard"
                      // show the raw typed string if present so trailing commas/spaces are preserved
                      value={borrowableInputs[r.id] ?? (r.borrowable_items ?? []).join(", ")}
                      onChange={(e) => setBorrowableInputs((s) => ({ ...s, [r.id]: e.target.value }))}
                      onBlur={(e) => {
                        const parsed = e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        setRooms((s) => s.map((x) => (x.id === r.id ? { ...x, borrowable_items: parsed.length ? parsed : null } : x)));
                        // normalise the raw input after commit so it looks clean
                        setBorrowableInputs((s) => ({ ...s, [r.id]: parsed.join(", ") }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          // commit on Enter as well
                          const val = (e.target as HTMLInputElement).value;
                          const parsed = val.split(",").map((s) => s.trim()).filter(Boolean);
                          setRooms((s) => s.map((x) => (x.id === r.id ? { ...x, borrowable_items: parsed.length ? parsed : null } : x)));
                          setBorrowableInputs((s) => ({ ...s, [r.id]: parsed.join(", ") }));
                        }
                      }}
                    />
                  </div>
                  <div className="col-span-1 flex items-center gap-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={!!r.is_available} onChange={(e) => handleToggleRoomField(r.id, "is_available", e.target.checked)} />
                    </label>
                  </div>
                  <div className="col-span-1 flex items-center gap-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={!!r.is_open} onChange={(e) => handleToggleRoomField(r.id, "is_open", e.target.checked)} />
                    </label>
                  </div>
                  <div className="col-span-3 flex gap-2 justify-end">
                    <button className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "px-2 py-1 bg-red-600 text-white") } onClick={() => deleteRoom(r.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {/* Quick-add form at bottom of the list */}
              <div className="mt-2">
                <NewRoomForm onCreate={createRoom} />
              </div>
            </div>
          )}
        </section>

        <section className="mb-8 bg-card p-2 rounded-md">
          <h2 className="text-sm font-medium mb-0 leading-tight normal-case">Courses</h2>
          {loadingCourses ? (
            <div>Loading courses...</div>
          ) : (
            <div className="space-y-1 w-full">
              {/* Column headings - courses start at the left so inputs align with rooms */}
              <div className="grid grid-cols-12 gap-2 items-center font-medium text-sm text-muted-foreground border-b pb-0">
                <div className="col-span-6 flex items-center gap-2">
                  <div className="h-7 w-full max-w-[12rem] flex items-center">Name</div>
                  <div className="h-7 w-10 flex items-center">Color</div>
                </div>
                <div className="col-span-6 flex items-center h-7">&nbsp;</div>
              </div>
              {courses.map((c) => (
                <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6 flex items-center gap-2">
                    <Input
                      className="h-7 text-xs w-full max-w-[12rem]"
                      value={c.name}
                      onChange={(e) => setCourses((s) => s.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                    />
                    <input
                      className="h-7 w-10 border rounded-sm"
                      type="color"
                      value={c.color_hex ?? "#000000"}
                      onChange={(e) => setCourses((s) => s.map((x) => (x.id === c.id ? { ...x, color_hex: e.target.value } : x)))}
                    />
                  </div>
                  <div className="col-span-6 flex gap-1 justify-end">
                    <button className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "px-2 py-1 bg-red-600 text-white")} onClick={() => deleteCourse(c.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {/* Quick-add form at bottom of the list */}
              <div className="mt-2">
                <CourseCreator onCreate={(name, color) => createCourse(name, color)} />
              </div>
            </div>
          )}
        </section>

        {/* Mods removed from this UI - managed elsewhere */}

        {/* Dialog removed - inline edits only */}
      </div>
    </main>
  );
};

function CourseCreator({ onCreate }: { onCreate: (name: string, color?: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  return (
    <div className="grid grid-cols-12 gap-2 items-center w-full">
      <div className="col-span-6 flex items-center gap-2">
        <Input className="h-7 text-xs w-full max-w-[12rem]" placeholder="Course name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="h-7 w-10 border rounded-sm" type="color" value={color || "#000000"} onChange={(e) => setColor(e.target.value)} />
      </div>
      <div className="col-span-6 flex justify-end">
        <button className={cn(buttonVariants({ variant: "default", size: "sm" }), "px-2 py-1 bg-blue-600 text-white")} onClick={() => { if (name.trim()) { onCreate(name.trim(), color.trim() || undefined); setName(""); setColor(""); } }}>
          Add
        </button>
      </div>
    </div>
  );
}

function NewRoomForm({ onCreate }: { onCreate: (payload: { name: string; capacity?: number | null; borrowable_items?: string[] | null; dynamic_labels?: string[] | null; is_available?: boolean; is_open?: boolean }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  const [borrowable, setBorrowable] = useState<string>("");
  const [dynamicLabels, setDynamicLabels] = useState<string>("");
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  return (
      <div className="grid grid-cols-12 gap-2 items-center w-full">
      <div className="col-span-2">
        <Input className="h-7 text-xs max-w-[10rem]" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="col-span-1">
        <Input className="h-7 text-xs w-16" type="number" placeholder="cap" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
      </div>
      <div className="col-span-4">
        <Input className="h-7 text-xs" placeholder="e.g. projector, whiteboard" value={borrowable} onChange={(e) => setBorrowable(e.target.value)} />
      </div>
      <div className="col-span-1 flex items-center gap-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
        </label>
      </div>
      <div className="col-span-1 flex items-center gap-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} />
        </label>
      </div>
      <div className="col-span-3 flex gap-2 justify-end">
        <button className={cn(buttonVariants({ variant: "default", size: "sm" }), "px-2 py-1 bg-blue-600 text-white") } onClick={async () => {
          if (!name.trim()) return;
          await onCreate({
            name: name.trim(),
            capacity: capacity ? Number(capacity) : null,
            borrowable_items: borrowable ? borrowable.split(",").map((s) => s.trim()).filter(Boolean) : null,
            dynamic_labels: dynamicLabels ? dynamicLabels.split(",").map((s) => s.trim()).filter(Boolean) : null,
            is_available: isAvailable,
            is_open: isOpen,
          });
          setName("");
          setCapacity("");
          setBorrowable("");
          setDynamicLabels("");
          setIsAvailable(true);
          setIsOpen(true);
        }}>Add</button>
      </div>
    </div>
  );
}

export default Settings;
