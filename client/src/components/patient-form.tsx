import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { insertPatientSchema } from "@shared/schema";

const formSchema = insertPatientSchema.extend({
  age: z.coerce.number().min(0).max(150).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PatientFormProps {
  onSubmit: (data: FormData) => void;
  isSubmitting?: boolean;
}

export function PatientForm({ onSubmit, isSubmitting }: PatientFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientId: "",
      name: "",
      age: undefined,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="patientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-medical-label">Patient ID</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Enter patient ID"
                  className="h-12"
                  data-testid="input-patient-id"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-medical-label">Patient Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Enter patient name"
                  className="h-12"
                  data-testid="input-patient-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-medical-label">Age (Optional)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  placeholder="Enter age"
                  className="h-12"
                  data-testid="input-patient-age"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isSubmitting}
          data-testid="button-create-case"
        >
          {isSubmitting ? "Creating..." : "Create Patient Case"}
        </Button>
      </form>
    </Form>
  );
}
