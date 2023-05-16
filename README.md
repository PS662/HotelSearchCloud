# Hotel Search Application
## Table of Contents

- [About](#about)
- [Getting Started](#getting_started)
- [Usage](#usage)

## About <a name = "about"></a>

A simple docker application on top of a simple hotel search application, uses two microservices to perform basic search. 
Uses Kubernetes on top of these microservices to create a cluster. This also allows port forwarding and adds test program to search kubernetes service.

## Getting Started <a name = "getting_started"></a>

### Prerequisites

To run this project, you need to have:
1. docker or docker-desktop
2. kubernetes
3. kubectl
4. Node (Optional, only if you want to run test program)
5. mongodb

Follow steps to set-up mongodb with the cluster:

https://github.com/mongodb/mongodb-kubernetes-operator/blob/master/docs/install-upgrade.md#procedure-using-kubectl

TLDR: (Works with: https://github.com/mongodb/mongodb-kubernetes-operator/releases/tag/v0.8.0):

```
git clone https://github.com/mongodb/mongodb-kubernetes-operator.git
cd mongodb-kubernetes-operator
kubectl create namespace mongodb
kubectl apply -f config/crd/bases/mongodbcommunity.mongodb.com_mongodbcommunity.yaml --namespace mongodb
kubectl get crd/mongodbcommunity.mongodbcommunity.mongodb.com --namespace mongodb #Verify whether created
kubectl apply -k config/rbac/ --namespace mongodb
kubectl create -f config/manager/manager.yaml --namespace mongodb
kubectl get pods --namespace mongodb #verify pods
kubectl create secret generic hotel-password --from-literal=password=hotel_password --namespace mongodb
```

External Access:
https://github.com/mongodb/mongodb-kubernetes-operator/blob/master/docs/external_access.md

```
kubectl apply -f .\k8s\mongodb-pv.yaml --namespace mongodb
kubectl apply -f .\k8s\mongodb-pvc.yaml --namespace mongodb
kubectl apply -f .\k8s\mongodb-storage.yaml --namespace mongodb
kubectl apply -f .\k8s\mongodb.yaml --namespace mongodb
```

Cleanup:

```
kubectl delete deployment nlp-service --namespace mongodb
kubectl delete service nlp-service --namespace mongodb
kubectl delete deployment search-service --namespace mongodb
kubectl delete service search-service --namespace mongodb
kubectl delete mongodbcommunity mongodb --namespace mongodb
kubectl delete storageclass mongodb-storage
kubectl delete namespaces mongodb
```


### Installing

1. Clone this repository: `git clone https://github.com/ps662/sit323_737-2023-t1-prac7c.git`
2. Navigate to the project directory: `cd sit323_737-2023-t1-prac7c`

## Usage <a name = "usage"></a>

To start the server, run the following command:

```
kubectl apply -f k8s/nlp_service.yaml --namespace mongodb
kubectl apply -f k8s/nlp_deployment.yaml --namespace mongodb
kubectl apply -f k8s/search_deployment.yaml --namespace mongodb
kubectl apply -f k8s/search_service.yaml --namespace mongodb
```

This will start the server and listen on port 3000. You can access the application in your web browser by visiting [http://localhost:3000](http://localhost:3000).

To enable port forwarding:

```
kubectl port-forward service/search-service 3000:3000
kubectl port-forward service/nlp-service 3001:3001
```

After this, you can also test the application by (you need node installed for this):

```
node .\simple_test_query.js
```

If you also want to monitor using the dashboard then use:

```
# Change version according to your kubectl
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml
kubectl apply -f k8s/admin_dashboard.yaml
kubectl proxy
```

To generate an access token use:

```
kubectl -n kubernetes-dashboard create token admin-user
```

Navigate to http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/ and use the generated token to access the dashboard.





