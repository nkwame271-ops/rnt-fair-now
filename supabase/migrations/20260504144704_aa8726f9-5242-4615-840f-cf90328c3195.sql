
-- Reply log table
CREATE TABLE public.contact_message_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.contact_submissions(id) ON DELETE CASCADE,
  replied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  subject text,
  body text NOT NULL,
  template_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_replies_submission ON public.contact_message_replies(submission_id);

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS last_replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_count int NOT NULL DEFAULT 0;

-- Templates table
CREATE TABLE public.contact_reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms')),
  subject text,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_contact_reply_templates_updated_at
  BEFORE UPDATE ON public.contact_reply_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.contact_message_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_reply_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Main admins manage replies"
  ON public.contact_message_replies FOR ALL
  USING (public.is_main_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()));

CREATE POLICY "Main admins manage templates"
  ON public.contact_reply_templates FOR ALL
  USING (public.is_main_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()));

-- Auto-update submission status / counters after a reply is logged
CREATE OR REPLACE FUNCTION public.handle_contact_reply_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contact_submissions
    SET status = 'replied',
        last_replied_at = NEW.created_at,
        reply_count = COALESCE(reply_count, 0) + 1
  WHERE id = NEW.submission_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contact_reply_inserted
  AFTER INSERT ON public.contact_message_replies
  FOR EACH ROW EXECUTE FUNCTION public.handle_contact_reply_inserted();

-- Seed default templates
INSERT INTO public.contact_reply_templates (name, channel, subject, body) VALUES
('Welcome / Create Account', 'email', 'Welcome to Rent Control Ghana',
'Hello {{name}},

Thank you for reaching out to Rent Control Ghana. To assist you better, please create an account on our platform: https://rentcontrolghana.com

Once registered, our team will guide you through the next steps.

Regards,
Rent Control Ghana Support'),
('File a Complaint', 'email', 'Filing your complaint',
'Hello {{name}},

To formally file your complaint, please:
1. Create an account at https://rentcontrolghana.com
2. Sign in as a Tenant
3. Go to "File a Complaint" and submit the details

Our case officers will review and route it to the appropriate office.

Regards,
Rent Control Ghana Support'),
('Register a Property', 'email', 'Registering your property',
'Hello {{name}},

To register your property:
1. Create a Landlord account at https://rentcontrolghana.com
2. Complete Ghana Card verification
3. Pay the landlord registration fee
4. Use "Register New Property" to add your property and units

Regards,
Rent Control Ghana Support'),
('General Follow-up', 'email', 'Follow-up on your message',
'Hello {{name}},

Thank you for contacting Rent Control Ghana. We have received your message and a member of our team will be in touch shortly.

Regards,
Rent Control Ghana Support');
