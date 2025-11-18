import Hamburger from "@/components/ui/hamburger";

const Analytics = () => {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 flex items-center gap-3">
          <Hamburger />
        </div>
        <div className="h-[60vh] flex items-center justify-center">
          <h2 className="text-lg">Analytics (placeholder)</h2>
        </div>
      </div>
    </main>
  );
};

export default Analytics;
