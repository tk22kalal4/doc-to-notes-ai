import { useState } from 'react';
import { Scissors, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PageSelectorProps {
  totalPages: number;
  onSplit: (ranges: string) => void;
}

export const PageSelector = ({ totalPages, onSplit }: PageSelectorProps) => {
  const [pageRanges, setPageRanges] = useState('1-' + totalPages);

  const handleSplit = () => {
    onSplit(pageRanges);
  };

  return (
    <Card className="p-6 shadow-lg border-l-4 border-l-accent">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Scissors className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Split PDF Pages</h3>
            <p className="text-sm text-muted-foreground">
              Select pages or ranges to process
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="page-ranges" className="text-sm font-medium">
            Page Ranges
          </Label>
          <Input
            id="page-ranges"
            value={pageRanges}
            onChange={(e) => setPageRanges(e.target.value)}
            placeholder="e.g., 1-5, 8, 10-12"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Total pages: {totalPages}
          </p>
        </div>

        <Button 
          onClick={handleSplit} 
          className="w-full gap-2"
          size="lg"
        >
          <CheckCircle2 className="h-5 w-5" />
          Confirm Selection
        </Button>
      </div>
    </Card>
  );
};
