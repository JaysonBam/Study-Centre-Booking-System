import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Authorization = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Button variant="ghost" onClick={() => navigate("/bookings")}>Back</Button>
        </div>
        <div className="h-[60vh] flex items-center justify-center">
          <h2 className="text-lg">Authorization (placeholder)</h2>
        </div>
      </div>
    </main>
  );
};

export default Authorization;
