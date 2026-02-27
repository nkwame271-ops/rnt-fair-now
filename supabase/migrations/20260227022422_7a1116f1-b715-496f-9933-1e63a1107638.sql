-- Create watchlist table
CREATE TABLE public.watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_user_id UUID NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_user_id, unit_id)
);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage own watchlist"
ON public.watchlist
FOR ALL
USING (auth.uid() = tenant_user_id)
WITH CHECK (auth.uid() = tenant_user_id);

-- Create marketplace messages table
CREATE TABLE public.marketplace_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_user_id UUID NOT NULL,
  receiver_user_id UUID NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages"
ON public.marketplace_messages
FOR SELECT
USING (auth.uid() = sender_user_id OR auth.uid() = receiver_user_id);

CREATE POLICY "Authenticated users can send messages"
ON public.marketplace_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_user_id);

CREATE POLICY "Receiver can update read status"
ON public.marketplace_messages
FOR UPDATE
USING (auth.uid() = receiver_user_id);