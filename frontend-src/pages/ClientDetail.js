import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import { formatCurrency, formatDate, formatPhone, getWhatsAppLink, statusLabels, statusColors, deviceTypeLabels } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ArrowLeft, Phone, Mail, MapPin, MessageCircle, User, Smartphone, ClipboardList } from "lucide-react";
import { toast } from "sonner";

const ClientDetail = () => {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [history, setHistory] = useState({ orders: [], devices: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientRes, historyRes] = await Promise.all([
          api.get(`/clients/${id}`),
          api.get(`/clients/${id}/history`),
        ]);
        setClient(clientRes.data);
        setHistory(historyRes.data);
      } catch (error) {
        toast.error("Erro ao carregar dados do cliente");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Link to="/clients">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="client-detail">
      <div className="flex items-center gap-4">
        <Link to="/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-muted-foreground">Detalhes do cliente</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{formatPhone(client.phone)}</span>
                <a
                  href={getWhatsAppLink(client.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{client.email}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{client.address}</span>
              </div>
            )}
            {client.cpf_cnpj && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">CPF/CNPJ</p>
                <p className="font-mono">{client.cpf_cnpj}</p>
              </div>
            )}

            <div className="pt-4 border-t grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Gasto</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(client.total_spent)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ordens</p>
                <p className="text-lg font-bold">{client.orders_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <Tabs defaultValue="orders">
            <CardHeader>
              <TabsList>
                <TabsTrigger value="orders" className="gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Ordens ({history.orders.length})
                </TabsTrigger>
                <TabsTrigger value="devices" className="gap-2">
                  <Smartphone className="h-4 w-4" />
                  Aparelhos ({history.devices.length})
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="orders" className="mt-0">
                {history.orders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma ordem de serviço</p>
                ) : (
                  <div className="space-y-3">
                    {history.orders.map((order) => (
                      <Link
                        key={order.id}
                        to={`/orders/${order.id}`}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div>
                          <p className="font-mono font-medium">{order.order_number}</p>
                          <p className="text-sm text-muted-foreground">{order.device_info}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
                          <p className="text-sm font-medium mt-1">{formatCurrency(order.total)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="devices" className="mt-0">
                {history.devices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum aparelho cadastrado</p>
                ) : (
                  <div className="space-y-3">
                    {history.devices.map((device) => (
                      <div key={device.id} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{device.brand} {device.model}</p>
                            <p className="text-sm text-muted-foreground">{deviceTypeLabels[device.type]}</p>
                          </div>
                          {device.serial_imei && (
                            <p className="font-mono text-sm text-muted-foreground">{device.serial_imei}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default ClientDetail;
