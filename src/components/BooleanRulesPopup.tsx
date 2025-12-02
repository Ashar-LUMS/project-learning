import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, CheckCircle, AlertCircle, Copy, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";

interface BooleanRulesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rules: string[]) => void;
  initialRules?: string[];
}

export function BooleanRulesPopup({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialRules = [] 
}: BooleanRulesPopupProps) {
  const [rules, setRules] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (initialRules.length > 0) {
      setRules(initialRules.join("\n"));
    } else {
      // Set default example rules
      setRules(`a = (b || c) && (!d)
b = e && f
c = !g
d = h || i
e = true
f = false
g = true
h = true
i = false`);
    }
  }, [initialRules]);

  const validateRules = (rulesText: string): string[] => {
    const lines = rulesText.split("\n");
    const newErrors: string[] = [];
    const nodeNames = new Set<string>();
    
    // Check each line
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (trimmedLine === "") return;
      
      // Check for valid format: node = expression
      if (!trimmedLine.includes("=")) {
        newErrors.push(`Line ${index + 1}: Missing equals sign (=)`);
        return;
      }
      
      const [leftSide, rightSide] = trimmedLine.split("=").map(s => s.trim());
      
      // Check left side (target node)
      if (!leftSide || leftSide === "") {
        newErrors.push(`Line ${index + 1}: Missing target node name`);
        return;
      }
      
      // Check for invalid characters in node name
      const invalidChars = /[!#$%^&*"{}[\]\\]/;
      if (invalidChars.test(leftSide)) {
        newErrors.push(`Line ${index + 1}: Node name "${leftSide}" contains special characters`);
      }
      
      // Check for reserved words in node name
      const reservedWords = [
        "sin", "cos", "tan", "log", "ln", "log10", 
        "exp", "pi", "sinh", "cosh", "tanh", "abs"
      ];
      if (reservedWords.includes(leftSide.toLowerCase())) {
        newErrors.push(`Line ${index + 1}: Node name "${leftSide}" uses reserved word`);
      }
      
      // Check for duplicate node definitions
      if (nodeNames.has(leftSide)) {
        newErrors.push(`Line ${index + 1}: Node "${leftSide}" is defined multiple times`);
      } else {
        nodeNames.add(leftSide);
      }
      
      // Check right side (expression)
      if (!rightSide || rightSide === "") {
        newErrors.push(`Line ${index + 1}: Missing Boolean expression for "${leftSide}"`);
        return;
      }
      
      // Validate expression syntax
      try {
        // Test if expression can be parsed
        const testVars = new Set<string>();
        const varsInExpr = rightSide.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
        varsInExpr.forEach(v => {
          if (!reservedWords.includes(v.toLowerCase()) && v.toLowerCase() !== 'true' && v.toLowerCase() !== 'false') {
            testVars.add(v);
          }
        });
        
        // Create test function with dummy variables
        const testFunc = new Function(
          ...Array.from(testVars),
          `return ${rightSide}`
        );
        
        // Try with random boolean values
        const testArgs = Array.from(testVars).map(() => Math.random() > 0.5);
        testFunc(...testArgs);
        
      } catch (error) {
        newErrors.push(`Line ${index + 1}: Invalid Boolean expression for "${leftSide}"`);
      }
    });
    
    // Check for undefined variables
    const definedNodes = new Set<string>();
    const usedVariables = new Set<string>();
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine === "" || !trimmedLine.includes("=")) return;
      
      const [leftSide, rightSide] = trimmedLine.split("=").map(s => s.trim());
      definedNodes.add(leftSide);
      
      // Extract variables from right side
      const vars = rightSide.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
      vars.forEach(v => {
        if (v.toLowerCase() !== 'true' && v.toLowerCase() !== 'false') {
          usedVariables.add(v);
        }
      });
    });
    
    // Find undefined variables (that aren't defined as nodes)
    usedVariables.forEach(variable => {
      if (!definedNodes.has(variable)) {
        newErrors.push(`Undefined variable "${variable}" used in expressions`);
      }
    });
    
    return newErrors;
  };

  const handleSubmit = () => {
    const validationErrors = validateRules(rules);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setSuccess(false);
      return;
    }
    
    // Parse rules into array
    const rulesArray = rules
      .split("\n")
      .map(line => line.trim())
      .filter(line => line !== "");
    
    // Submit to parent component
    onSubmit(rulesArray);
    setSuccess(true);
    setErrors([]);
    
    // Close after successful submission
    setTimeout(() => {
      onClose();
      setSuccess(false);
    }, 1500);
  };

  const handleClose = () => {
    setErrors([]);
    setSuccess(false);
    onClose();
  };

  const exampleRules = `a = (b || c) && (!d)
b = e && f
c = !g
d = h || i
e = true
f = false
g = true
h = true
i = false`;

  const complexExample = `gene1 = (input1 && !inhibitor) || gene2
gene2 = gene1 && !feedback
input1 = true
inhibitor = false
feedback = gene2 && time_delay
time_delay = true`;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            Boolean Rules Editor
          </DialogTitle>
          <DialogDescription>
            Define your Boolean network using JavaScript syntax. One rule per node.
          </DialogDescription>
        </DialogHeader>

        {/* Instructions Section */}
        <Alert className="mb-4">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription className="ml-2">
            Enter Boolean rules that define your network in JavaScript syntax
          </AlertDescription>
        </Alert>

        {/* Syntax Reference */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <Label className="text-sm font-medium mb-2 block">Boolean Logic Reference</Label>
            <div className="space-y-2 text-sm bg-muted/30 p-3 rounded-md border">
              <div className="flex justify-between items-center py-1 border-b">
                <span className="font-medium">AND</span>
                <code className="bg-background px-2 py-1 rounded text-xs">&&</code>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="font-medium">OR</span>
                <code className="bg-background px-2 py-1 rounded text-xs">||</code>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="font-medium">NOT</span>
                <code className="bg-background px-2 py-1 rounded text-xs">!</code>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="font-medium">TRUE</span>
                <code className="bg-background px-2 py-1 rounded text-xs">true</code>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-medium">FALSE</span>
                <code className="bg-background px-2 py-1 rounded text-xs">false</code>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Quick Examples</Label>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRules(exampleRules)}
                className="w-full justify-start text-left h-auto py-2"
              >
                <Copy className="h-3 w-3 mr-2 flex-shrink-0" />
                <span className="text-xs">Simple network (9 nodes)</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRules(complexExample)}
                className="w-full justify-start text-left h-auto py-2"
              >
                <Copy className="h-3 w-3 mr-2 flex-shrink-0" />
                <span className="text-xs">Gene regulatory network</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRules("")}
                className="w-full justify-start text-left h-auto py-2"
              >
                <Trash2 className="h-3 w-3 mr-2 flex-shrink-0" />
                <span className="text-xs">Clear all rules</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Rules Input */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <Label htmlFor="rules-input" className="text-sm font-medium">
              Boolean Rules (one per line)
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {rules.split('\n').filter(l => l.trim()).length} rules
              </span>
            </div>
          </div>
          <Textarea
            id="rules-input"
            placeholder={`Enter one rule per line, e.g.:
a = (b || c) && (!d)
b = e && f
c = true
d = false`}
            value={rules}
            onChange={(e) => {
              setRules(e.target.value);
              setErrors([]);
            }}
            className="font-mono text-sm h-64 resize-none"
          />
          <div className="text-xs text-muted-foreground mt-2 space-y-1">
            <p>• Format: <code className="bg-muted px-1 rounded">node = Boolean_expression</code></p>
            <p>• Use letters/underscores for node names (no special characters)</p>
            <p>• Empty lines are ignored</p>
            <p>• Example: <code className="bg-muted px-1 rounded">a = (b || c) && (!d)</code></p>
          </div>
        </div>

        {/* Error Display */}
        {errors.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              <div className="text-sm font-medium mb-1">Validation Errors:</div>
              <ul className="list-disc pl-4 space-y-1 max-h-32 overflow-y-auto">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm">{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {success && (
          <Alert className="mb-4 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="ml-2 text-green-800">
              Rules validated successfully! Creating network...
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="min-w-[120px]">
            Create Network
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}